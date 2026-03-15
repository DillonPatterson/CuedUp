import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const REPO_ROOT = process.cwd();

type FileKind = "engine" | "ui" | "fixture" | "other";

type ReplayUpdateFile = {
  path: string;
  statText: string;
  kind: FileKind;
  impact: string;
};

type ReplayUpdatesResponse = {
  commitHash: string | null;
  commitMessage: string | null;
  relativeTime: string | null;
  files: ReplayUpdateFile[];
  uncommittedFiles: string[];
};

const IMPACT_RULES: Array<{
  pattern: RegExp;
  kind: FileKind;
  impact: string;
}> = [
  {
    pattern: /^lib\/(live|state)\//,
    kind: "engine",
    impact: "Step replay checkpoints and inspect thread, guard, and nudge output.",
  },
  {
    pattern: /^lib\/transcript\//,
    kind: "engine",
    impact: "Append turns and inspect replay-local metadata and downstream outputs.",
  },
  {
    pattern: /^components\/live\/(interview-replay|transcript-panel|nudge-rail|presence-decision-log|thread-bank|topic-map)/,
    kind: "ui",
    impact: "Open replay and verify this inspection surface updates as snapshots change.",
  },
  {
    pattern: /^components\/live\/replay-/,
    kind: "ui",
    impact: "Open replay and verify testing flow, fixture controls, and panel rendering.",
  },
  {
    pattern: /^app\/interview\/.+\/replay\/page\.tsx$/,
    kind: "ui",
    impact: "Open the replay route and verify the testing layout still fits cleanly.",
  },
  {
    pattern: /^app\/api\/dev\/replay-updates\/route\.ts$/,
    kind: "ui",
    impact: "Refresh replay and verify the Updates panel still reports the last commit cleanly.",
  },
  {
    pattern: /^lib\/mock\//,
    kind: "fixture",
    impact: "Reload fixtures and recheck the expected snapshot checkpoints.",
  },
  {
    pattern: /^scripts\/(prove-replay-checkpoints|verify-replay-turn-normalization)\.ts$/,
    kind: "fixture",
    impact: "Rerun replay proof scripts and fixture-based validation.",
  },
];

async function runGit(args: string[]) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });

    return stdout.trimEnd();
  } catch {
    return "";
  }
}

function classifyFile(path: string): Pick<ReplayUpdateFile, "kind" | "impact"> {
  const match = IMPACT_RULES.find((rule) => rule.pattern.test(path));

  if (match) {
    return {
      kind: match.kind,
      impact: match.impact,
    };
  }

  return {
    kind: "other",
    impact: "Retest the nearby replay/dev flow if this file matters to your pass.",
  };
}

function parseStatFiles(rawStat: string) {
  return rawStat
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trimEnd())
    .filter((line) => line.includes("|"))
    .map((line) => {
      const match = line.match(/^\s*(.+?)\s+\|\s+(.+)$/);

      if (!match) {
        return null;
      }

      const path = match[1].trim();
      const statText = match[2].trim();
      const { kind, impact } = classifyFile(path);

      return {
        path,
        statText,
        kind,
        impact,
      } satisfies ReplayUpdateFile;
    })
    .filter((file): file is ReplayUpdateFile => file !== null);
}

function parseUncommittedFiles(rawStatus: string) {
  return rawStatus
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

export const dynamic = "force-dynamic";

export async function GET() {
  const showOutput = await runGit([
    "show",
    "--stat",
    "--format=%H%n%s%n%cr",
    "HEAD",
    "--",
  ]);

  if (!showOutput) {
    return NextResponse.json<ReplayUpdatesResponse>({
      commitHash: null,
      commitMessage: null,
      relativeTime: null,
      files: [],
      uncommittedFiles: [],
    });
  }

  const [commitHash = null, commitMessage = null, relativeTime = null] =
    showOutput.split(/\r?\n/);
  const statusOutput = await runGit(["status", "--short", "--untracked-files=all"]);

  return NextResponse.json<ReplayUpdatesResponse>({
    commitHash,
    commitMessage,
    relativeTime,
    files: parseStatFiles(showOutput),
    uncommittedFiles: parseUncommittedFiles(statusOutput),
  });
}
