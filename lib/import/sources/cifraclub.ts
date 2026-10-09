import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import type { RawChart } from "@/types/import";

import {
  canHandleCifraClubUrl,
  extractCifraClubRawChart,
  ImportSourceError,
} from "./cifraclub-parse";

const NAVIGATION_INTERVAL_MS = 10_000;
const IDLE_CLOSE_MS = 60_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_CACHE_DIRECTORY = path.join(".cache", "cifraclub");

export type CifraClubResponse = {
  status(): number;
};

export type CifraClubPage = {
  goto(
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ): Promise<CifraClubResponse | null>;
  url(): string;
  content(): Promise<string>;
  close(): Promise<void>;
};

export type CifraClubBrowser = {
  isConnected(): boolean;
  newPage(): Promise<CifraClubPage>;
  close(): Promise<void>;
};

type TimerHandle = unknown;

export type CifraClubSourceDependencies = {
  launch(options: { headless: false }): Promise<CifraClubBrowser>;
  readCache(path: string): Promise<string>;
  writeCache(path: string, html: string): Promise<void>;
  removeCache(path: string): Promise<void>;
  now(): number;
  sleep(milliseconds: number): Promise<void>;
  setIdleTimer(callback: () => void, delay: number): TimerHandle;
  clearIdleTimer(handle: TimerHandle): void;
  cacheDirectory: string;
};

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

export function cifraClubCachePath(
  url: string,
  cacheDirectory = DEFAULT_CACHE_DIRECTORY,
): string {
  const hash = createHash("sha256").update(canonicalUrl(url)).digest("hex");
  return path.join(cacheDirectory, `${hash}.html`);
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error &&
    (error.name === "TimeoutError" || /timed?\s*out|timeout/i.test(error.message));
}

function blockedHtml(html: string): boolean {
  return /captcha|akamai|access denied|verify you are human/i.test(html);
}

function sourceError(error: unknown): ImportSourceError {
  if (error instanceof ImportSourceError) {
    return error;
  }

  if (isTimeout(error)) {
    return new ImportSourceError(
      "SOURCE_TIMEOUT",
      "A página do Cifra Club excedeu o tempo limite de 30 segundos.",
      { cause: error },
    );
  }

  return new ImportSourceError(
    "SOURCE_BLOCKED",
    "Não foi possível abrir o Chromium local. Instale-o com `npx playwright install chromium`.",
    { cause: error },
  );
}

export class CifraClubSource {
  private browser?: CifraClubBrowser;
  private idleTimer?: TimerHandle;
  private lastNavigationStarted?: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: CifraClubSourceDependencies) {}

  async fetch(value: string): Promise<RawChart> {
    if (!canHandleCifraClubUrl(value)) {
      throw new ImportSourceError("UNSUPPORTED_SOURCE", "A URL informada não é do Cifra Club.");
    }

    const url = canonicalUrl(value);
    const cached = await this.readCached(url);
    if (cached) {
      return cached;
    }

    const result = this.queue.then(() => this.fetchQueued(url));
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readCached(url: string): Promise<RawChart | undefined> {
    const cachePath = cifraClubCachePath(url, this.dependencies.cacheDirectory);

    try {
      const html = await this.dependencies.readCache(cachePath);
      return extractCifraClubRawChart(
        html,
        url,
        new Date(this.dependencies.now()).toISOString(),
      );
    } catch (error) {
      if (isMissingFile(error)) {
        return undefined;
      }
      if (error instanceof ImportSourceError && error.code === "SOURCE_LAYOUT_CHANGED") {
        await this.dependencies.removeCache(cachePath);
        return undefined;
      }
      throw error;
    }
  }

  private async fetchQueued(url: string): Promise<RawChart> {
    await this.waitForNavigationSlot();

    let page: CifraClubPage | undefined;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      this.lastNavigationStarted = this.dependencies.now();
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS,
      });

      if (!response || response.status() === 403 || response.status() === 429) {
        throw new ImportSourceError(
          "SOURCE_BLOCKED",
          "O Cifra Club bloqueou a navegação automatizada.",
        );
      }

      const finalUrl = page.url();
      if (!canHandleCifraClubUrl(finalUrl)) {
        throw new ImportSourceError(
          "SOURCE_BLOCKED",
          "O redirecionamento saiu dos hosts permitidos.",
        );
      }

      const html = await page.content();
      if (blockedHtml(html)) {
        throw new ImportSourceError(
          "SOURCE_BLOCKED",
          "O Cifra Club apresentou uma página de bloqueio ou captcha.",
        );
      }

      const rawChart = extractCifraClubRawChart(
        html,
        canonicalUrl(finalUrl),
        new Date(this.dependencies.now()).toISOString(),
      );
      await this.dependencies.writeCache(
        cifraClubCachePath(url, this.dependencies.cacheDirectory),
        html,
      );
      return rawChart;
    } catch (error) {
      throw sourceError(error);
    } finally {
      await page?.close();
      this.scheduleIdleClose();
    }
  }

  private async waitForNavigationSlot(): Promise<void> {
    if (this.lastNavigationStarted === undefined) {
      return;
    }

    const elapsed = this.dependencies.now() - this.lastNavigationStarted;
    const wait = Math.max(0, NAVIGATION_INTERVAL_MS - elapsed);
    if (wait > 0) {
      await this.dependencies.sleep(wait);
    }
  }

  private async getBrowser(): Promise<CifraClubBrowser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    this.browser = await this.dependencies.launch({ headless: false });
    return this.browser;
  }

  private scheduleIdleClose(): void {
    if (!this.browser) {
      return;
    }
    if (this.idleTimer !== undefined) {
      this.dependencies.clearIdleTimer(this.idleTimer);
    }

    const browser = this.browser;
    this.idleTimer = this.dependencies.setIdleTimer(() => {
      if (this.browser === browser) {
        this.browser = undefined;
        void browser.close();
      }
    }, IDLE_CLOSE_MS);
  }
}

const defaultDependencies: CifraClubSourceDependencies = {
  launch: (options) => chromium.launch(options),
  readCache: (cachePath) => readFile(cachePath, "utf8"),
  writeCache: async (cachePath, html) => {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, html, "utf8");
  },
  removeCache: (cachePath) => rm(cachePath, { force: true }),
  now: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  setIdleTimer: (callback, delay) => setTimeout(callback, delay),
  clearIdleTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  cacheDirectory: DEFAULT_CACHE_DIRECTORY,
};

const defaultSource = new CifraClubSource(defaultDependencies);

export function createCifraClubSource(
  dependencies: CifraClubSourceDependencies,
): CifraClubSource {
  return new CifraClubSource(dependencies);
}

export function fetchCifraClubChart(url: string): Promise<RawChart> {
  return defaultSource.fetch(url);
}
