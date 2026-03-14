import evasiveRunPressure from "@/lib/mock/fixtures/evasive-run-pressure.json";
import saturationPlateauRepeat from "@/lib/mock/fixtures/saturation-plateau-repeat.json";
import threadRevisitLater from "@/lib/mock/fixtures/thread-revisit-later.json";

export type ReplayFixtureDefinition = {
  id: string;
  label: string;
  rawTranscript: string;
};

export const replayFixtures: ReplayFixtureDefinition[] = [
  {
    id: "thread-revisit-later",
    label: "thread-revisit-later",
    rawTranscript: JSON.stringify(threadRevisitLater, null, 2),
  },
  {
    id: "evasive-run-pressure",
    label: "evasive-run-pressure",
    rawTranscript: JSON.stringify(evasiveRunPressure, null, 2),
  },
  {
    id: "saturation-plateau-repeat",
    label: "saturation-plateau-repeat",
    rawTranscript: JSON.stringify(saturationPlateauRepeat, null, 2),
  },
];
