import { NextResponse } from "next/server";
import { createNudgeInputSchema } from "@/lib/schemas/nudge";

export async function POST(request: Request) {
  const payload = await request.json();
  const result = createNudgeInputSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json(
      { ok: false, errors: result.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Nudge request accepted.",
    data: result.data,
  });
}
