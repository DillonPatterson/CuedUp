import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";

const REPLAY_URL =
  process.env.CUEDUP_REPLAY_URL ??
  "http://localhost:3000/interview/mock-session/replay#listening-sandbox";

function collapseWhitespace(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function sectionTextByHeading(page: Page, heading: string) {
  const section = page
    .getByRole("heading", { name: heading })
    .locator("xpath=ancestor::section[1] | ancestor::aside[1]")
    .first();

  return collapseWhitespace(await section.textContent());
}

async function replaySnapshotIndex(page: Page) {
  const transcriptPanel = collapseWhitespace(
    await page.locator("#transcript-replay").textContent(),
  );
  const match = transcriptPanel.match(/Snapshot (\d+) \/ \d+/);

  assert.ok(match, "Replay snapshot label was not visible.");

  return Number.parseInt(match[1]!, 10);
}

async function gotoSnapshot(page: Page, targetSnapshotIndex: number) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const currentSnapshotIndex = await replaySnapshotIndex(page);

    if (currentSnapshotIndex === targetSnapshotIndex) {
      return;
    }

    await page
      .getByRole("button", {
        name: currentSnapshotIndex > targetSnapshotIndex ? "Previous" : "Next turn",
      })
      .click();
    await page.waitForTimeout(120);
  }

  throw new Error(`Unable to reach snapshot ${targetSnapshotIndex}.`);
}

function assertIncludesAny(
  haystack: string,
  needles: string[],
  message: string,
) {
  assert.ok(
    needles.some((needle) => haystack.includes(needle)),
    `${message} Expected one of: ${needles.join(", ")}`,
  );
}

function assertSurfacePopulated(surfaceText: string, label: string) {
  assert.ok(surfaceText.includes(label), `${label} section was not visible.`);
  assert.ok(
    !surfaceText.includes("No candidate next move is available yet."),
    `${label} was visible but had no top move content.`,
  );
}

async function loadFixture(page: Page, fixtureId: string) {
  await page.getByRole("button", { name: fixtureId, exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(await replaySnapshotIndex(page), 16, `${fixtureId} did not load fully.`);
}

async function inspectThreadRevisitLater(page: Page) {
  console.log("Inspecting thread-revisit-later");
  await loadFixture(page, "thread-revisit-later");

  await gotoSnapshot(page, 2);
  const earlyThreadBank = await sectionTextByHeading(page, "Unresolved threads");
  assert.ok(
    earlyThreadBank.includes("Brother's relapse as the hidden risk lens"),
    "Snapshot 2 did not visibly show the family/trust thread.",
  );

  for (const snapshotIndex of [9, 10, 11, 12]) {
    await gotoSnapshot(page, snapshotIndex);

    const transcript = collapseWhitespace(
      await page.locator("#transcript-replay").textContent(),
    );
    const threadBank = await sectionTextByHeading(page, "Unresolved threads");
    const nudgeRail = await sectionTextByHeading(page, "Operator nudge rail");
    const presenceLog = await sectionTextByHeading(page, "Cue decisions");

    assertIncludesAny(
      `${transcript} ${threadBank} ${nudgeRail}`,
      [
        "Brother's relapse as the hidden risk lens",
        "Nevada restructuring and worker trust",
        "brother",
        "trust",
        "family",
      ],
      `Snapshot ${snapshotIndex} did not visibly keep the reactivated thread in play.`,
    );
    assertSurfacePopulated(nudgeRail, "Operator nudge rail");
    assert.ok(
      presenceLog.includes("Current turn evaluations"),
      `Snapshot ${snapshotIndex} did not show populated Presence Guard evaluations.`,
    );
  }

  await gotoSnapshot(page, 15);
  const snapshot15Transcript = collapseWhitespace(
    await page.locator("#transcript-replay").textContent(),
  );
  assert.ok(
    snapshot15Transcript.includes(
      "So the family thread and the labor thread are actually the same trust problem.",
    ),
    "Snapshot 15 did not visibly show the later-payoff trust connection.",
  );

  await gotoSnapshot(page, 16);
  const snapshot16Transcript = collapseWhitespace(
    await page.locator("#transcript-replay").textContent(),
  );
  assert.ok(
    snapshot16Transcript.includes(
      "That is the connection I resisted saying out loud for years.",
    ),
    "Snapshot 16 did not visibly show the later-payoff acknowledgment.",
  );
}

async function inspectSaturationPlateauRepeat(page: Page) {
  console.log("Inspecting saturation-plateau-repeat");
  await loadFixture(page, "saturation-plateau-repeat");

  for (const snapshotIndex of [9, 10, 11, 12]) {
    await gotoSnapshot(page, snapshotIndex);

    const nudgeRail = await sectionTextByHeading(page, "Operator nudge rail");
    const presenceLog = await sectionTextByHeading(page, "Cue decisions");
    const threadBank = await sectionTextByHeading(page, "Unresolved threads");

    assertIncludesAny(
      `${nudgeRail} ${presenceLog}`,
      ["repetition", "tighten", "Top candidate repeated", "cooldown"],
      `Snapshot ${snapshotIndex} did not visibly show repetition/tightening behavior.`,
    );
    assert.ok(
      threadBank.includes("Unresolved threads"),
      `Snapshot ${snapshotIndex} did not keep the thread bank visible.`,
    );
  }
}

async function inspectEvasiveRunPressure(page: Page) {
  console.log("Inspecting evasive-run-pressure");
  await loadFixture(page, "evasive-run-pressure");
  await gotoSnapshot(page, 16);

  const transcript = collapseWhitespace(
    await page.locator("#transcript-replay").textContent(),
  );
  const proofGuide = await sectionTextByHeading(page, "Fixture proof guide");
  const threadBank = await sectionTextByHeading(page, "Unresolved threads");

  assert.ok(
    transcript.includes("Yes, and I regret what that meant for trust."),
    "Snapshot 16 did not visibly show the breakthrough answer text.",
  );
  assert.ok(
    transcript.includes("Specificity high") && transcript.includes("Cue high"),
    "Snapshot 16 did not visibly show the higher-signal committed-turn state.",
  );
  assert.ok(
    proofGuide.includes("Breakthrough answer"),
    "Snapshot 16 did not visibly keep the breakthrough checkpoint in focus.",
  );
  assert.ok(
    threadBank.includes("Nevada restructuring and worker trust"),
    "Snapshot 16 did not visibly keep the accountability/trust thread present.",
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(REPLAY_URL, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.getByRole("button", { name: "thread-revisit-later" }).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    await inspectThreadRevisitLater(page);
    await inspectSaturationPlateauRepeat(page);
    await inspectEvasiveRunPressure(page);

    console.log("Replay checkpoint proof passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
