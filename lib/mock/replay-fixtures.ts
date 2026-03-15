import evasiveRunPressure from "@/lib/mock/fixtures/evasive-run-pressure.json";
import saturationPlateauRepeat from "@/lib/mock/fixtures/saturation-plateau-repeat.json";
import threadRevisitLater from "@/lib/mock/fixtures/thread-revisit-later.json";

export type ReplayFixtureDefinition = {
  id: string;
  label: string;
  transcript: unknown;
  goal: string;
  expectedBehaviors: string[];
  inspectAreas: string[];
  successSignal: string;
  failureSignal: string;
  checkpoints: ReplayFixtureCheckpoint[];
};

export type ReplayFixtureCheckpoint = {
  id: string;
  label: string;
  targetStartSnapshotIndex: number;
  targetEndSnapshotIndex: number;
  inspect: string;
  expected: string;
  failure: string;
};

export const replayFixtures: ReplayFixtureDefinition[] = [
  {
    id: "thread-revisit-later",
    label: "thread-revisit-later",
    transcript: threadRevisitLater,
    goal:
      "Prove that a meaningful unresolved thread can open early, cool, then become active again when the conversation returns to it.",
    expectedBehaviors: [
      "The brother/trust thread should open early and remain meaningfully unresolved after the first pass.",
      "The thread bank should show that thread staying present while other topics briefly take focus.",
      "Presence Guard and top moves should pull attention back toward the revisited thread rather than treating it as resolved too early.",
      "When specificity breaks through later, the thread should sharpen instead of looking like a brand-new topic.",
    ],
    inspectAreas: [
      "Thread bank for carryover and later reactivation.",
      "Cue decisions for whether the system resurfaces the thread at the right moment.",
      "Operator nudge rail for whether the top move follows the reopened thread.",
      "Topic saturation for whether the vein progresses without falsely closing too soon.",
    ],
    successSignal:
      "The same underlying thread clearly persists across the middle turns, then becomes active again with later specificity.",
    failureSignal:
      "The thread disappears too early, restarts as if unrelated, or produces noisy cues that ignore the revisit.",
    checkpoints: [
      {
        id: "early-open",
        label: "Early open",
        targetStartSnapshotIndex: 2,
        targetEndSnapshotIndex: 3,
        inspect:
          "Thread bank and cue decisions right after the first brother/trust exchange.",
        expected:
          "The family-trust thread should register as genuinely open instead of resolving immediately or being ignored.",
        failure:
          "The thread never really opens, or the system treats it as resolved before the conversation moves away from it.",
      },
      {
        id: "reactivation-moment",
        label: "Reactivation moment",
        targetStartSnapshotIndex: 9,
        targetEndSnapshotIndex: 12,
        inspect:
          "Lead thread, top move, and current decision as the conversation returns to the brother thread.",
        expected:
          "The same unresolved thread should come back into focus, and the top move should follow that revisit instead of inventing a new unrelated lane.",
        failure:
          "The revisit looks detached from the earlier thread, or replay becomes noisy instead of sharpening around the reactivation.",
      },
      {
        id: "later-payoff",
        label: "Later payoff",
        targetStartSnapshotIndex: 15,
        targetEndSnapshotIndex: 16,
        inspect:
          "Final thread state, cue surface, and topic progression once the trust connection is said more directly.",
        expected:
          "Later specificity should deepen or partially resolve the existing thread rather than leaving it flat and disconnected.",
        failure:
          "The payoff moment does not materially change state, or the engine still behaves as if the thread never carried through.",
      },
    ],
  },
  {
    id: "evasive-run-pressure",
    label: "evasive-run-pressure",
    transcript: evasiveRunPressure,
    goal:
      "Prove that evasive answers increase pressure without causing the replay surface to become loud or spammy.",
    expectedBehaviors: [
      "Repeated low-specificity, high-evasion answers should keep contradictions unresolved instead of falsely resolving them.",
      "Presence Guard should suppress weak or repetitive cue output while pressure builds.",
      "The top move should stay focused on accountability and contradiction pressure rather than bouncing randomly.",
      "When the guest finally gives a concrete answer, state should shift in a visible way.",
    ],
    inspectAreas: [
      "Cue decisions for suppression reasons during the evasive stretch.",
      "Thread bank for contradiction and accountability threads staying unresolved.",
      "Operator nudge rail for whether the top move remains appropriately sharp.",
      "Current decision chain for whether suppression gives way when a specific answer lands.",
    ],
    successSignal:
      "Most evasive turns suppress or sharpen pressure cleanly, and the late specific answer creates a visible state shift.",
    failureSignal:
      "The system chatters through the evasive run, resolves pressure too early, or fails to react when specificity finally appears.",
    checkpoints: [
      {
        id: "evasion-established",
        label: "Evasion established",
        targetStartSnapshotIndex: 4,
        targetEndSnapshotIndex: 6,
        inspect:
          "Cue decisions and unresolved contradiction pressure during the first cluster of evasive guest answers.",
        expected:
          "The contradiction should remain unresolved and Presence Guard should avoid surfacing noisy low-value cues.",
        failure:
          "Replay either chatters through the evasive stretch or falsely treats the contradiction as settled.",
      },
      {
        id: "accountability-pressure",
        label: "Accountability pressure",
        targetStartSnapshotIndex: 11,
        targetEndSnapshotIndex: 15,
        inspect:
          "Top move, thread bank, and suppression reasons as the host tightens into explicit accountability questions.",
        expected:
          "The top move should stay pointed at accountability, with suppression or pressure behavior staying coherent instead of bouncing between themes.",
        failure:
          "The system loses the accountability lane, diffuses pressure, or starts surfacing cues that do not fit the contradiction.",
      },
      {
        id: "breakthrough-answer",
        label: "Breakthrough answer",
        targetStartSnapshotIndex: 16,
        targetEndSnapshotIndex: 16,
        inspect:
          "Current decision and thread state immediately after the guest gives the specific yes-and-regret answer.",
        expected:
          "That answer should create a visible state shift relative to the evasive run that came before it.",
        failure:
          "Replay treats the concrete answer like more evasion, or the contradiction state barely changes after the breakthrough.",
      },
    ],
  },
  {
    id: "saturation-plateau-repeat",
    label: "saturation-plateau-repeat",
    transcript: saturationPlateauRepeat,
    goal:
      "Prove that repetition and declining novelty quiet the system instead of producing a noisy stream of redundant guidance.",
    expectedBehaviors: [
      "The same story vein should saturate steadily instead of opening a parade of fake new threads.",
      "Low-novelty repetition should reduce useful cue surface area over time.",
      "Presence Guard should keep output sparse once the topic is clearly plateauing.",
      "The replay should end looking saturated rather than unresolved and noisy.",
    ],
    inspectAreas: [
      "Topic saturation for the repeated vein progressing toward covered or plateaued states.",
      "Cue decisions for repetition, cooldown, or other suppression behavior.",
      "Operator nudge rail for whether top moves grow quieter instead of inventing novelty.",
      "Thread bank for whether unresolved load actually drops instead of ballooning.",
    ],
    successSignal:
      "The conversation visibly plateaus, cue output stays sparse, and the system stops pretending the repetition is new.",
    failureSignal:
      "The system keeps surfacing fresh-looking cues or unresolved threads even though the transcript is clearly circling.",
    checkpoints: [
      {
        id: "saturation-building",
        label: "Saturation building",
        targetStartSnapshotIndex: 4,
        targetEndSnapshotIndex: 6,
        inspect:
          "Topic saturation and unresolved thread count while the same factory/trust lane is still productively advancing.",
        expected:
          "The core vein should progress without spawning a pile of fake new unresolved threads.",
        failure:
          "The same lane already looks fragmented or noisy before the plateau phase starts.",
      },
      {
        id: "repetition-obvious",
        label: "Repetition obvious",
        targetStartSnapshotIndex: 9,
        targetEndSnapshotIndex: 12,
        inspect:
          "Cue decisions, top moves, and novelty-sensitive behavior once the transcript is clearly repeating itself.",
        expected:
          "Cue surface area should tighten and the system should stop acting as if repetition is fresh discovery.",
        failure:
          "Replay keeps surfacing new-looking guidance despite obvious repetition.",
      },
      {
        id: "plateau-confirmed",
        label: "Plateau confirmed",
        targetStartSnapshotIndex: 15,
        targetEndSnapshotIndex: 16,
        inspect:
          "End-state thread bank, topic saturation, and cue output after the guest openly admits repetition.",
        expected:
          "The end of the run should read as plateaued and quieter, not like an expanding unresolved-state problem.",
        failure:
          "The system still behaves as if new unresolved opportunity is opening when the transcript is plainly saturated.",
      },
    ],
  },
];

export function getReplayFixtureDefinition(fixtureId: string) {
  return replayFixtures.find((fixture) => fixture.id === fixtureId) ?? null;
}
