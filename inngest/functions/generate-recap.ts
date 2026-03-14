import { inngest } from "@/inngest/client";

export const generateRecap = inngest.createFunction(
  { id: "generate-recap" },
  { event: "cuedup/recap.requested" },
  async ({ event }) => {
    return {
      status: "placeholder",
      message: "Recap generation has not been implemented yet.",
      sessionId: event.data.sessionId ?? null,
    };
  },
);
