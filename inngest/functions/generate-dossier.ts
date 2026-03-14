import { inngest } from "@/inngest/client";

export const generateDossier = inngest.createFunction(
  { id: "generate-dossier" },
  { event: "cuedup/dossier.requested" },
  async ({ event }) => {
    return {
      status: "placeholder",
      message: "Dossier generation has not been implemented yet.",
      guestId: event.data.guestId ?? null,
    };
  },
);
