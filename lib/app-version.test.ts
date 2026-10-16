import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { execFileSync } from "node:child_process";

import packageJson from "../package.json";

import { formatAppVersionLabel, getAppVersion } from "./app-version";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(execFileSync).mockReset();
});

describe("formatAppVersionLabel", () => {
  it("joins the package version with the short commit hash", () => {
    expect(formatAppVersionLabel("0.2.0", "56c3ad1abcdef1234567890abcdef1234567890")).toBe(
      "v0.2.0 · 56c3ad1",
    );
  });

  it("shows only the version when the commit hash is missing", () => {
    expect(formatAppVersionLabel("0.2.0", null)).toBe("v0.2.0");
  });
});

describe("getAppVersion", () => {
  it("reads the version from package.json and the hash from Vercel", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "56c3ad1abcdef1234567890abcdef1234567890");

    expect(getAppVersion()).toMatchObject({
      version: packageJson.version,
      sha: "56c3ad1abcdef1234567890abcdef1234567890",
      label: `v${packageJson.version} · 56c3ad1`,
    });
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("omits the hash when the deployed commit sha is missing", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");

    expect(getAppVersion()).toMatchObject({
      version: packageJson.version,
      sha: null,
      label: `v${packageJson.version}`,
    });
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("reads the local git commit when Vercel did not inject a hash", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.mocked(execFileSync).mockReturnValue("abcdef1234567890abcdef1234567890abcdef12\n");

    expect(getAppVersion().label).toBe(`v${packageJson.version} · abcdef1`);
    expect(execFileSync).toHaveBeenCalledWith("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  });
});
