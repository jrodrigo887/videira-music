import "server-only";

import { execFileSync } from "node:child_process";

import packageJson from "../package.json";

export type AppVersion = {
  version: string;
  sha: string | null;
  label: string;
};

export function formatAppVersionLabel(version: string, sha: string | null): string {
  const named = `v${version}`;
  const short = sha?.slice(0, 7);
  if (!short) {
    return named;
  }
  return `${named} · ${short}`;
}

function normalizeSha(value: string | undefined): string | null {
  const sha = value?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    return null;
  }
  return sha;
}

function readCommitSha(): string | null {
  const fromVercel = normalizeSha(process.env.VERCEL_GIT_COMMIT_SHA);
  if (fromVercel) {
    return fromVercel;
  }
  if (process.env.VERCEL) {
    return null;
  }

  try {
    const output = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return normalizeSha(output);
  } catch {
    return null;
  }
}

export function getAppVersion(): AppVersion {
  const version = packageJson.version;
  const sha = readCommitSha();
  return {
    version,
    sha,
    label: formatAppVersionLabel(version, sha),
  };
}
