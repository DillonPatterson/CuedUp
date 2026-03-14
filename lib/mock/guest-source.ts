import type { DossierGenerationInput } from "@/lib/dossier/contracts";
import { sampleTranscriptExcerpt } from "@/lib/mock/sample-transcript";

export const DEFAULT_MOCK_GUEST_SLUG = "test-guest";

const maraVanceSource: DossierGenerationInput = {
  guestId: "22222222-2222-4222-8222-222222222222",
  guestSlug: "mara-vance",
  guestName: "Mara Vance",
  title: "Mara Vance prep dossier",
  interviewFocus:
    "Build a dossier for a long-form interview about reinvention, public accountability, and personal cost.",
  notes:
    "Prioritize emotionally live material, contradictions about scale, and underexplored labor questions.",
  sources: [
    {
      id: "31111111-1111-4111-8111-111111111111",
      mode: "url",
      title: "Profile: The Founder Who Turned Grid Anxiety Into a Climate Business",
      url: "https://example.com/mara-vance-profile",
      content:
        "Mara Vance describes growing up in a Midwestern factory town where the mill closure shaped her obsession with resilient systems. She frames her company as a way to protect ordinary communities from brittle infrastructure. The profile repeats her language around reinvention, systems discipline, and refusing vanity growth.",
      tags: ["reinvention", "systems", "origin story"],
    },
    {
      id: "32222222-2222-4222-8222-222222222222",
      mode: "url",
      title: "Summit interview on scaling climate infrastructure",
      url: "https://example.com/mara-vance-summit",
      content:
        "At a 2024 summit, Vance said she never wanted to run a public company because public markets reward theater. She said she preferred to stay private and move slowly if she could protect the mission. She also implied that labor trust is built locally, not from a board deck.",
      tags: ["public markets", "labor", "trust"],
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      mode: "notes",
      title: "Producer notes from pre-interview research",
      content:
        "Repeated themes: reinvention after collapse, moral language around reliability, discomfort with celebrity-founder framing. Emotionally live thread: Mara's brother's relapse after the mill closed. Underexplored topic: how the Nevada restructuring landed with plant workers who felt blindsided.",
      tags: ["emotion", "family", "underexplored"],
    },
    {
      id: "34444444-4444-4444-8444-444444444444",
      mode: "transcript_excerpt",
      title: "Podcast transcript excerpt",
      content: sampleTranscriptExcerpt,
      notes:
        "Contains the cleanest contradiction about public-company ambition and the strongest emotional cue around her brother.",
      tags: ["transcript", "contradiction", "live thread"],
    },
  ],
};

const testGuestSource: DossierGenerationInput = {
  ...maraVanceSource,
  guestSlug: DEFAULT_MOCK_GUEST_SLUG,
  title: "Default test guest dossier",
  notes:
    "Default development guest alias. Uses the current Mara Vance mock source set so /api/dossier?guestId=test-guest and /dossier/test-guest work out of the box.",
};

const mockSources = [testGuestSource, maraVanceSource];

export function getMockGuestSourceBySlug(guestSlug: string) {
  return mockSources.find((entry) => entry.guestSlug === guestSlug) ?? null;
}

export function getMockGuestSourceById(guestId: string) {
  return mockSources.find((entry) => entry.guestId === guestId) ?? null;
}

export function getDefaultMockGuestSource() {
  return mockSources[0];
}

export function listMockGuestSources() {
  return mockSources;
}
