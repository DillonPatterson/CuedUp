import { generateMockDossierBundle } from "@/lib/dossier/generate";
import { DEFAULT_MOCK_GUEST_SLUG, getMockGuestSourceBySlug } from "@/lib/mock/guest-source";
import {
  MOCK_REPLAY_SESSION_ID,
  mockTranscriptTurns,
} from "@/lib/mock/transcript-turns";

export function getMockInterviewSession() {
  const source = getMockGuestSourceBySlug(DEFAULT_MOCK_GUEST_SLUG);

  if (!source) {
    return null;
  }

  const bundle = generateMockDossierBundle(source);

  return {
    engineSessionId: MOCK_REPLAY_SESSION_ID,
    guestName: bundle.input.guestName,
    handoff: bundle.liveHandoff,
    transcriptTurns: mockTranscriptTurns,
  };
}
