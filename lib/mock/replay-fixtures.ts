import evasiveRunPressure from "@/lib/mock/fixtures/evasive-run-pressure.json";
import saturationPlateauRepeat from "@/lib/mock/fixtures/saturation-plateau-repeat.json";
import threadRevisitLater from "@/lib/mock/fixtures/thread-revisit-later.json";

export type ReplayFixtureDefinition = {
  id: string;
  label: string;
  transcript: unknown;
};

export const replayFixtures: ReplayFixtureDefinition[] = [
  {
    id: "thread-revisit-later",
    label: "thread-revisit-later",
    transcript: threadRevisitLater,
  },
  {
    id: "evasive-run-pressure",
    label: "evasive-run-pressure",
    transcript: evasiveRunPressure,
  },
  {
    id: "saturation-plateau-repeat",
    label: "saturation-plateau-repeat",
    transcript: saturationPlateauRepeat,
  },
];
