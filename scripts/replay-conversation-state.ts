import { generateMockDossierBundle } from "@/lib/dossier/generate";
import { DEFAULT_MOCK_GUEST_SLUG, getMockGuestSourceBySlug } from "@/lib/mock/guest-source";
import { MOCK_REPLAY_SESSION_ID, mockTranscriptTurns } from "@/lib/mock/transcript-turns";
import {
  matchTurnToThreads,
  planNextMove,
  processTranscriptTurn,
  seedConversationStateFromDossier,
} from "@/lib/state/conversation-engine";

function printSnapshot(label: string, value: string) {
  console.log(`${label.padEnd(18)} ${value}`);
}

const source = getMockGuestSourceBySlug(DEFAULT_MOCK_GUEST_SLUG);

if (!source) {
  throw new Error(`Mock guest '${DEFAULT_MOCK_GUEST_SLUG}' is not available.`);
}

const bundle = generateMockDossierBundle(source);
let state = seedConversationStateFromDossier(
  MOCK_REPLAY_SESSION_ID,
  bundle.liveHandoff,
);

console.log(`Replay guest: ${bundle.input.guestName} (${DEFAULT_MOCK_GUEST_SLUG})`);
console.log(`Session: ${MOCK_REPLAY_SESSION_ID}`);
console.log(`Seeded threads: ${state.threads.length}`);
console.log("");

for (const turn of mockTranscriptTurns) {
  const matchedThreads = matchTurnToThreads(turn, state);
  state = processTranscriptTurn(state, turn, bundle.liveHandoff);
  const planned = planNextMove(state, bundle.liveHandoff);

  console.log("=".repeat(72));
  console.log(`${turn.timestamp} | ${turn.speaker.toUpperCase()}`);
  console.log(turn.text);
  printSnapshot(
    "Matched threads",
    matchedThreads.length > 0
      ? matchedThreads.map((thread) => thread.label).join(", ")
      : "none",
  );
  printSnapshot(
    "Unresolved",
    `${state.activeThreads.length} | ${state.threads
      .filter((thread) => thread.status !== "resolved")
      .map((thread) => `${thread.label} (${thread.status}, ${thread.saturation.toFixed(2)})`)
      .join("; ")}`,
  );
  printSnapshot(
    "Covered veins",
    state.coveredVeins.length > 0 ? state.coveredVeins.join(", ") : "none",
  );
  printSnapshot("Mode", planned.mode);
  printSnapshot("Closure", state.closureConfidence.toFixed(2));
  printSnapshot("Heat", state.emotionalHeat.toFixed(2));
  printSnapshot("Stale guard", String(planned.staleNudgeGuard));
  printSnapshot(
    "Next moves",
    planned.candidateNextMoves
      .slice(0, 3)
      .map(
        (move) =>
          `${move.label} [${move.type}, p=${move.priority.toFixed(2)}${
            move.promptFragment ? `, prompt=${move.promptFragment}` : ""
          }]`,
      )
      .join(" || "),
  );
  console.log("");
}
