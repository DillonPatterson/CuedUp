import assert from "node:assert/strict";
import { chromium, type Locator, type Page } from "playwright";

const REPLAY_URL =
  process.env.CUEDUP_REPLAY_URL ??
  "http://localhost:3000/interview/mock-session/replay#listening-sandbox";

function collapseWhitespace(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function regionText(locator: Locator) {
  return collapseWhitespace(await locator.textContent());
}

function headingRegion(page: Page, heading: string) {
  return page
    .getByText(heading, { exact: true })
    .locator("xpath=ancestor::article[1] | ancestor::section[1] | ancestor::aside[1]")
    .first();
}

async function clickButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });

  await button.waitFor({ state: "visible", timeout: 30_000 });
  await button.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

async function waitForReplayReady(page: Page) {
  await page.locator("#conversation-workspace").waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page
    .getByRole("textbox", { name: "Editable draft transcript" })
    .waitFor({ state: "visible", timeout: 30_000 });
}

async function clearReplayState(page: Page) {
  await clickButton(page, "Wipe replay restore state");
  await page.waitForFunction(
    () => {
      const workspace = document.querySelector("#conversation-workspace");
      return (workspace?.textContent ?? "").includes("Empty replay session");
    },
    undefined,
    { timeout: 10_000 },
  );
}

async function clearListeningSandbox(page: Page) {
  await clickButton(page, "Clear session");
  await page.waitForFunction(
    () => {
      const textarea = document.querySelector(
        "textarea",
      ) as HTMLTextAreaElement | null;
      return textarea ? textarea.value.length === 0 : false;
    },
    undefined,
    { timeout: 10_000 },
  );
}

async function captureWorkspaceSnapshot(page: Page) {
  return {
    workspace: await regionText(page.locator("#conversation-workspace")),
    transcriptRail: await regionText(page.locator("#workspace-transcript-rail")),
    recallQueue: await regionText(headingRegion(page, "Recall candidates")),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(REPLAY_URL, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await waitForReplayReady(page);
    await clearReplayState(page);
    await clearListeningSandbox(page);

    const draftBox = page.getByRole("textbox", {
      name: "Editable draft transcript",
    });
    await draftBox.fill("His relapse made risk feel personal.");
    await clickButton(page, "Commit to replay");

    await page.waitForFunction(
      (expectedText) => {
        const transcriptRail = document.querySelector("#workspace-transcript-rail");
        return (transcriptRail?.textContent ?? "").includes(expectedText);
      },
      "His relapse made risk feel personal.",
      { timeout: 10_000 },
    );

    const firstSnapshot = await captureWorkspaceSnapshot(page);
    assert.ok(
      firstSnapshot.workspace.includes("Replay-local transcript"),
      "Workspace did not switch into replay-local transcript mode after commit.",
    );
    assert.ok(
      firstSnapshot.transcriptRail.includes("His relapse made risk feel personal."),
      "Transcript rail did not show the committed speech.",
    );
    assert.ok(
      firstSnapshot.transcriptRail.includes("Listening sandbox draft"),
      "Transcript rail did not show the listening sandbox source label.",
    );
    assert.ok(
      firstSnapshot.workspace.includes("Emotion fear") ||
        firstSnapshot.workspace.includes("Emotion neutral"),
      "Current-turn analyzer did not render an emotion label.",
    );
    assert.ok(
      firstSnapshot.workspace.includes("Completion"),
      "Current-turn analyzer did not render completion status.",
    );
    assert.ok(
      firstSnapshot.recallQueue.includes("risk") ||
        firstSnapshot.recallQueue.includes("personal"),
      "Recall queue did not populate after committing speech.",
    );

    await draftBox.fill("I changed my mind because");
    await clickButton(page, "Commit to replay");

    await page.waitForFunction(
      () => {
        const workspace = document.querySelector("#conversation-workspace");
        return (workspace?.textContent ?? "").includes("I changed my mind because");
      },
      undefined,
      { timeout: 10_000 },
    );

    const secondSnapshot = await captureWorkspaceSnapshot(page);
    assert.ok(
      secondSnapshot.workspace.includes("incomplete") ||
        secondSnapshot.workspace.includes("truncated"),
      "Second committed turn did not surface incomplete/truncated analysis.",
    );

    console.log("Replay speech-only proof passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack ?? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
