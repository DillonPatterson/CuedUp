import {
  formatAudioCue,
  type AudioCueValidation,
} from "@/lib/live/audio-cue-formatter";
import type {
  TranscriptNextNudgeCandidate,
  TranscriptNextNudgeSelection,
} from "@/lib/transcript/organization/types";

export type AudioCueEvent = {
  id: string;
  candidateId: string;
  candidate: TranscriptNextNudgeCandidate;
  text: string;
  validation: AudioCueValidation;
};

export function buildAudioCueEvent(
  selection: TranscriptNextNudgeSelection,
): AudioCueEvent | null {
  const candidate = selection.bestCandidate;

  if (!candidate) {
    return null;
  }

  const formattedCue = formatAudioCue(candidate);

  if (!formattedCue || formattedCue.validation.isEmpty) {
    return null;
  }

  return {
    id: `audio-cue:${candidate.id}`,
    candidateId: candidate.id,
    candidate,
    text: formattedCue.text,
    validation: formattedCue.validation,
  };
}
