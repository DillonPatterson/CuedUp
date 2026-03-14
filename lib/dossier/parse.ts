import { z } from "zod";
import {
  confidenceBandSchema,
  contradictionSeveritySchema,
  dossierSchema,
  dossierSensitivitySchema,
  dossierStatusSchema,
  dossierImportanceSchema,
  sourceReferenceTypeSchema,
} from "@/lib/schemas/dossier";
import type { Dossier } from "@/types";

type DossierIssue = {
  path: string;
  message: string;
};

type DossierValidationFailure = {
  success: false;
  message: string;
  issues: DossierIssue[];
  formatted: ReturnType<typeof z.treeifyError>;
};

type DossierValidationSuccess = {
  success: true;
  data: Dossier;
};

export type DossierValidationResult =
  | DossierValidationFailure
  | DossierValidationSuccess;

function normalizeEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  fallback?: string,
) {
  if (typeof value !== "string") {
    return fallback ?? value;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return allowedValues.includes(normalized) ? normalized : (fallback ?? value);
}

function normalizeItemEnums(raw: unknown) {
  if (!Array.isArray(raw)) {
    return raw;
  }

  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }

    const item = { ...entry } as Record<string, unknown>;

    if ("importance" in item) {
      item.importance = normalizeEnumValue(
        item.importance,
        dossierImportanceSchema.options,
      );
    }

    if ("status" in item) {
      item.status = normalizeEnumValue(item.status, dossierStatusSchema.options);
    }

    if ("sensitivity" in item) {
      item.sensitivity = normalizeEnumValue(
        item.sensitivity,
        dossierSensitivitySchema.options,
      );
    }

    if ("severity" in item) {
      item.severity = normalizeEnumValue(
        item.severity,
        contradictionSeveritySchema.options,
      );
    }

    if ("confidence" in item) {
      item.confidence = normalizeEnumValue(
        item.confidence,
        confidenceBandSchema.options,
      );
    }

    if ("type" in item) {
      item.type = normalizeEnumValue(
        item.type,
        sourceReferenceTypeSchema.options,
      );
    }

    if ("momentType" in item) {
      item.momentType = normalizeEnumValue(item.momentType, [
        "opening",
        "pivot",
        "evasion",
        "emotion_spike",
        "contradiction",
        "wrap",
      ]);
    }

    return item;
  });
}

export function normalizeDossierPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const payload = { ...(raw as Record<string, unknown>) };
  payload.confidence = normalizeEnumValue(
    payload.confidence,
    confidenceBandSchema.options,
  );
  payload.storyVeins = normalizeItemEnums(payload.storyVeins);
  payload.liveWires = normalizeItemEnums(payload.liveWires);
  payload.contradictions = normalizeItemEnums(payload.contradictions);
  payload.unaskedTopics = normalizeItemEnums(payload.unaskedTopics);
  payload.sourceReferences = normalizeItemEnums(payload.sourceReferences);
  payload.followUpOpportunities = normalizeItemEnums(
    payload.followUpOpportunities,
  );

  return payload;
}

export function parseRawDossierJson(raw: string) {
  try {
    return {
      success: true as const,
      data: JSON.parse(raw),
    };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to parse dossier JSON.",
    };
  }
}

export function validateDossierPayload(raw: unknown): DossierValidationResult {
  const normalized = normalizeDossierPayload(raw);
  const result = dossierSchema.safeParse(normalized);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    message: "Dossier payload failed schema validation.",
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
    formatted: z.treeifyError(result.error),
  };
}

export function parseDossierOrThrow(raw: unknown) {
  const result = validateDossierPayload(raw);

  if (!result.success) {
    throw new Error(
      `Invalid dossier payload: ${result.issues
        .map((issue) => `${issue.path || "<root>"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return result.data;
}
