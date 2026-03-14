import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateDossier } from "@/inngest/functions/generate-dossier";
import { generateRecap } from "@/inngest/functions/generate-recap";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateDossier, generateRecap],
});
