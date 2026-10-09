import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  cifraClubCachePath,
  createCifraClubSource,
  type CifraClubBrowser,
  type CifraClubPage,
} from "./cifraclub";

const URL_ONE = "https://www.cifraclub.com.br/artista/uma/";
const URL_TWO = "https://www.cifraclub.com.br/artista/duas/";
const VALID_HTML =
  '<pre data-chord-content>[Verso]\n<b data-chord-name="C">C</b>\nLetra inventada</pre>';

class FakePage implements CifraClubPage {
  constructor(
    private readonly requestedUrl: string,
    private readonly html = VALID_HTML,
    private readonly statusCode = 200,
    private readonly finalUrl = requestedUrl,
    private readonly failure?: Error,
    private readonly onGoto?: () => void,
  ) {}

  async goto(): Promise<{ status(): number } | null> {
    this.onGoto?.();
    if (this.failure) throw this.failure;
    return { status: () => this.statusCode };
  }

  url(): string {
    return this.finalUrl;
  }

  async content(): Promise<string> {
    return this.html;
  }

  async close(): Promise<void> {}
}

class FakeBrowser implements CifraClubBrowser {
  connected = true;
  closed = false;

  constructor(private readonly pages: FakePage[]) {}

  isConnected(): boolean {
    return this.connected;
  }

  async newPage(): Promise<CifraClubPage> {
    const page = this.pages.shift();
    if (!page) throw new Error("No fake page configured");
    return page;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.connected = false;
  }
}

function harness(browsers: FakeBrowser[], initialCache: Record<string, string> = {}) {
  let clock = 0;
  const cache = new Map(Object.entries(initialCache));
  const removed: string[] = [];
  const idleTimers: Array<{ callback: () => void; delay: number }> = [];
  const launch = vi.fn(async () => {
    const browser = browsers.shift();
    if (!browser) throw new Error("No fake browser configured");
    return browser;
  });

  return {
    dependencies: {
      launch,
      readCache: async (path: string) => {
        const value = cache.get(path);
        if (value === undefined) {
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        }
        return value;
      },
      writeCache: async (path: string, html: string) => {
        cache.set(path, html);
      },
      removeCache: async (path: string) => {
        removed.push(path);
        cache.delete(path);
      },
      now: () => clock,
      sleep: async (milliseconds: number) => {
        clock += milliseconds;
      },
      setIdleTimer: (callback: () => void, delay: number) => {
        idleTimers.push({ callback, delay });
        return callback;
      },
      clearIdleTimer: () => {},
      cacheDirectory: ".cache/test-cifraclub",
    },
    launch,
    cache,
    removed,
    idleTimers,
    currentTime: () => clock,
  };
}

describe("createCifraClubSource", () => {
  it("queues navigation in FIFO order, spaces starts by 10 seconds and reuses a headed browser", async () => {
    const starts: Array<{ url: string; at: number }> = [];
    let currentTime = () => 0;
    const browser = new FakeBrowser([
      new FakePage(URL_ONE, VALID_HTML, 200, URL_ONE, undefined, () => {
        starts.push({ url: URL_ONE, at: currentTime() });
      }),
      new FakePage(URL_TWO, VALID_HTML, 200, URL_TWO, undefined, () => {
        starts.push({ url: URL_TWO, at: currentTime() });
      }),
    ]);
    const state = harness([browser]);
    currentTime = state.currentTime;
    const source = createCifraClubSource(state.dependencies);

    await Promise.all([source.fetch(URL_ONE), source.fetch(URL_TWO)]);

    expect(starts).toEqual([
      { url: URL_ONE, at: 0 },
      { url: URL_TWO, at: 10_000 },
    ]);
    expect(state.launch).toHaveBeenCalledTimes(1);
    expect(state.launch).toHaveBeenCalledWith({ headless: false });
    expect(state.idleTimers.at(-1)?.delay).toBe(60_000);

    await state.idleTimers.at(-1)?.callback();
    expect(browser.closed).toBe(true);
  });

  it("uses a SHA-256 canonical URL cache key without launching Chromium", async () => {
    const expectedHash = createHash("sha256").update(URL_ONE).digest("hex");
    const path = `.cache/test-cifraclub/${expectedHash}.html`;
    const state = harness([], { [path]: VALID_HTML });
    const source = createCifraClubSource(state.dependencies);

    const result = await source.fetch(`${URL_ONE}#fragment`);

    expect(cifraClubCachePath(`${URL_ONE}#fragment`, ".cache/test-cifraclub")).toBe(path);
    expect(result.text).toContain("Letra inventada");
    expect(state.launch).not.toHaveBeenCalled();
  });

  it("removes corrupt cache and fetches a fresh page", async () => {
    const path = cifraClubCachePath(URL_ONE, ".cache/test-cifraclub");
    const browser = new FakeBrowser([new FakePage(URL_ONE)]);
    const state = harness([browser], { [path]: "<html>cache inválido</html>" });
    const source = createCifraClubSource(state.dependencies);

    const result = await source.fetch(URL_ONE);

    expect(state.removed).toEqual([path]);
    expect(result.text).toContain("Letra inventada");
    expect(state.launch).toHaveBeenCalledTimes(1);
  });

  it("blocks redirects whose final host is not allowed", async () => {
    const browser = new FakeBrowser([
      new FakePage(URL_ONE, VALID_HTML, 200, "https://example.com/redirect"),
    ]);
    const source = createCifraClubSource(harness([browser]).dependencies);

    await expect(source.fetch(URL_ONE)).rejects.toMatchObject({ code: "SOURCE_BLOCKED" });
  });

  it("maps navigation timeouts to SOURCE_TIMEOUT", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const browser = new FakeBrowser([new FakePage(URL_ONE, VALID_HTML, 200, URL_ONE, timeout)]);
    const source = createCifraClubSource(harness([browser]).dependencies);

    await expect(source.fetch(URL_ONE)).rejects.toMatchObject({ code: "SOURCE_TIMEOUT" });
  });

  it.each([
    { status: 403, html: VALID_HTML },
    { status: 200, html: "<html>captcha challenge</html>" },
  ])("maps blocked responses to SOURCE_BLOCKED", async ({ status, html }) => {
    const browser = new FakeBrowser([new FakePage(URL_ONE, html, status)]);
    const source = createCifraClubSource(harness([browser]).dependencies);

    await expect(source.fetch(URL_ONE)).rejects.toMatchObject({ code: "SOURCE_BLOCKED" });
  });

  it("launches a replacement after the shared browser disconnects", async () => {
    const first = new FakeBrowser([new FakePage(URL_ONE)]);
    const second = new FakeBrowser([new FakePage(URL_TWO)]);
    const state = harness([first, second]);
    const source = createCifraClubSource(state.dependencies);

    await source.fetch(URL_ONE);
    first.connected = false;
    await source.fetch(URL_TWO);

    expect(state.launch).toHaveBeenCalledTimes(2);
  });
});
