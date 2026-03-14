import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  dossierGenerationInputSchema,
  dossierRequestSchema,
} from "@/lib/dossier/contracts";
import { generateMockDossierBundle } from "@/lib/dossier/generate";
import { getDefaultMockGuestSource, getMockGuestSourceById, getMockGuestSourceBySlug } from "@/lib/mock/guest-source";

function findMockSource(guestIdOrSlug: string | null) {
  if (!guestIdOrSlug) {
    return getDefaultMockGuestSource();
  }

  return (
    getMockGuestSourceBySlug(guestIdOrSlug) ??
    getMockGuestSourceById(guestIdOrSlug) ??
    null
  );
}

export async function GET(request: NextRequest) {
  const guestId = request.nextUrl.searchParams.get("guestId");
  const source = findMockSource(guestId);

  if (!source) {
    return NextResponse.json(
      { ok: false, message: "No mock dossier source found for that guest." },
      { status: 404 },
    );
  }

  const bundle = generateMockDossierBundle(source);

  return NextResponse.json({
    ok: true,
    mode: "mock",
    guestSlug: source.guestSlug,
    data: bundle,
  });
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const result = dossierRequestSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json(
      { ok: false, errors: z.treeifyError(result.error) },
      { status: 400 },
    );
  }

  const mockSource =
    findMockSource(result.data.guestSlug ?? result.data.guestId ?? null) ??
    getDefaultMockGuestSource();

  const generationInput = dossierGenerationInputSchema.parse({
    ...mockSource,
    ...result.data,
    guestId: mockSource.guestId,
    guestSlug: mockSource.guestSlug,
    guestName: result.data.guestName ?? mockSource.guestName,
    title: result.data.title ?? mockSource.title,
    interviewFocus: result.data.interviewFocus ?? mockSource.interviewFocus,
    notes: result.data.notes ?? mockSource.notes,
    sources: result.data.sources ?? mockSource.sources,
  });

  const bundle = generateMockDossierBundle(generationInput);

  return NextResponse.json({
    ok: true,
    mode: "mock",
    message: "Mock dossier generated.",
    data: bundle,
  });
}
