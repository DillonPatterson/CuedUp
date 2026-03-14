import { NextResponse } from "next/server";
import { transcriptTurnInputSchema } from "@/lib/schemas/transcript";

export async function POST(request: Request) {
  const payload = await request.json();
  const result = transcriptTurnInputSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json(
      { ok: false, errors: result.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Transcript turn recorded.",
    data: result.data,
  });
}
