import type { ReplayFixtureDefinition } from "@/lib/mock/replay-fixtures";

export type ReplayCheckpointStatus = "pending" | "observed" | "failed";
export type ReplayFixtureAssessment =
  | "pending"
  | "appears_to_pass"
  | "appears_to_fail";
export type FixtureReviewStatus =
  | "not_started"
  | "in_review"
  | "completed_with_failures"
  | "completed_all_observed";

export type ReplayCheckpointReview = {
  status: ReplayCheckpointStatus;
  note: string;
  lastUpdatedAt: string | null;
};

export type ReplayProofFixtureSession = {
  fixtureId: string;
  assessment: ReplayFixtureAssessment;
  checkpointReviews: Record<string, ReplayCheckpointReview>;
  lastUpdatedAt: string | null;
};

export type ReplayProofSession = {
  activeFixtureId: string | null;
  fixtures: Record<string, ReplayProofFixtureSession>;
  lastUpdatedAt: string | null;
};

export type ReplayProofFixtureSummary = {
  fixtureId: string;
  label: string;
  assessment: ReplayFixtureAssessment;
  reviewStatus: FixtureReviewStatus;
  lastUpdatedAt: string | null;
  totalCheckpoints: number;
  observedCount: number;
  failedCount: number;
  pendingCount: number;
  checkpoints: Array<{
    id: string;
    label: string;
    status: ReplayCheckpointStatus;
    note: string;
    lastUpdatedAt: string | null;
  }>;
};

export type ReplayProofSummary = {
  activeFixtureId: string | null;
  overallStatus: "incomplete" | "completed_with_failures" | "completed_all_observed";
  lastUpdatedAt: string | null;
  completedFixtureCount: number;
  failedFixtureCount: number;
  pendingFixtureCount: number;
  fixtures: ReplayProofFixtureSummary[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeCheckpointStatus(value: unknown): ReplayCheckpointStatus {
  if (value === "observed" || value === "failed") {
    return value;
  }

  return "pending";
}

function sanitizeFixtureAssessment(value: unknown): ReplayFixtureAssessment {
  if (value === "appears_to_pass" || value === "appears_to_fail") {
    return value;
  }

  return "pending";
}

function nowIsoString() {
  return new Date().toISOString();
}

export function buildInitialProofSession(
  fixtures: ReplayFixtureDefinition[],
): ReplayProofSession {
  return {
    activeFixtureId: null,
    lastUpdatedAt: null,
    fixtures: Object.fromEntries(
      fixtures.map((fixture) => [
        fixture.id,
        {
          fixtureId: fixture.id,
          assessment: "pending" as const,
          checkpointReviews: Object.fromEntries(
            fixture.checkpoints.map((checkpoint) => [
              checkpoint.id,
              {
                status: "pending" as const,
                note: "",
                lastUpdatedAt: null,
              },
            ]),
          ),
          lastUpdatedAt: null,
        },
      ]),
    ),
  };
}

export function setActiveProofFixture(
  session: ReplayProofSession,
  fixtureId: string | null,
): ReplayProofSession {
  if (session.activeFixtureId === fixtureId) {
    return session;
  }

  return {
    ...session,
    activeFixtureId: fixtureId,
    lastUpdatedAt: nowIsoString(),
  };
}

export function hydrateProofSession(
  fixtures: ReplayFixtureDefinition[],
  rawSession: string | null,
): ReplayProofSession {
  const initialSession = buildInitialProofSession(fixtures);

  if (!rawSession) {
    return initialSession;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawSession);
  } catch {
    return initialSession;
  }

  if (!isObjectRecord(parsed)) {
    return initialSession;
  }

  const storedFixtures = isObjectRecord(parsed.fixtures) ? parsed.fixtures : {};

  return {
    activeFixtureId:
      typeof parsed.activeFixtureId === "string" &&
      parsed.activeFixtureId in initialSession.fixtures
        ? parsed.activeFixtureId
        : null,
    lastUpdatedAt:
      typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
    fixtures: Object.fromEntries(
      fixtures.map((fixture) => {
        const storedFixture = isObjectRecord(storedFixtures[fixture.id])
          ? (storedFixtures[fixture.id] as Record<string, unknown>)
          : {};
        const storedCheckpointReviews = isObjectRecord(
          storedFixture.checkpointReviews,
        )
          ? (storedFixture.checkpointReviews as Record<string, unknown>)
          : {};

        return [
          fixture.id,
          {
            fixtureId: fixture.id,
            assessment: sanitizeFixtureAssessment(storedFixture.assessment),
            lastUpdatedAt:
              typeof storedFixture.lastUpdatedAt === "string"
                ? storedFixture.lastUpdatedAt
                : null,
            checkpointReviews: Object.fromEntries(
              fixture.checkpoints.map((checkpoint) => {
                const storedReview = isObjectRecord(
                  storedCheckpointReviews[checkpoint.id],
                )
                  ? (storedCheckpointReviews[checkpoint.id] as Record<
                      string,
                      unknown
                    >)
                  : {};

                return [
                  checkpoint.id,
                  {
                    status: sanitizeCheckpointStatus(storedReview.status),
                    note:
                      typeof storedReview.note === "string"
                        ? storedReview.note
                        : "",
                    lastUpdatedAt:
                      typeof storedReview.lastUpdatedAt === "string"
                        ? storedReview.lastUpdatedAt
                        : null,
                  },
                ];
              }),
            ),
          },
        ];
      }),
    ),
  };
}

export function updateFixtureAssessment(
  session: ReplayProofSession,
  fixtureId: string,
  assessment: ReplayFixtureAssessment,
): ReplayProofSession {
  const fixtureSession = session.fixtures[fixtureId];

  if (!fixtureSession) {
    return session;
  }

  return {
    ...session,
    lastUpdatedAt: nowIsoString(),
    fixtures: {
      ...session.fixtures,
      [fixtureId]: {
        ...fixtureSession,
        assessment,
        lastUpdatedAt: nowIsoString(),
      },
    },
  };
}

export function updateCheckpointReview(
  session: ReplayProofSession,
  fixtureId: string,
  checkpointId: string,
  patch: Partial<ReplayCheckpointReview>,
): ReplayProofSession {
  const fixtureSession = session.fixtures[fixtureId];
  const checkpointReview = fixtureSession?.checkpointReviews[checkpointId];

  if (!fixtureSession || !checkpointReview) {
    return session;
  }

  const nextTimestamp = nowIsoString();

  return {
    ...session,
    lastUpdatedAt: nextTimestamp,
    fixtures: {
      ...session.fixtures,
      [fixtureId]: {
        ...fixtureSession,
        lastUpdatedAt: nextTimestamp,
        checkpointReviews: {
          ...fixtureSession.checkpointReviews,
          [checkpointId]: {
            ...checkpointReview,
            ...patch,
            lastUpdatedAt: nextTimestamp,
          },
        },
      },
    },
  };
}

export function summarizeFixtureReview(
  fixture: ReplayFixtureDefinition,
  session: ReplayProofSession,
): ReplayProofFixtureSummary {
  const fixtureSession = session.fixtures[fixture.id];
  const checkpoints = fixture.checkpoints.map((checkpoint) => {
    const review = fixtureSession?.checkpointReviews[checkpoint.id];

    return {
      id: checkpoint.id,
      label: checkpoint.label,
      status: review?.status ?? "pending",
      note: review?.note ?? "",
      lastUpdatedAt: review?.lastUpdatedAt ?? null,
    };
  });

  const observedCount = checkpoints.filter(
    (checkpoint) => checkpoint.status === "observed",
  ).length;
  const failedCount = checkpoints.filter(
    (checkpoint) => checkpoint.status === "failed",
  ).length;
  const pendingCount = checkpoints.length - observedCount - failedCount;

  let reviewStatus: FixtureReviewStatus = "not_started";

  if (observedCount === 0 && failedCount === 0) {
    reviewStatus = "not_started";
  } else if (pendingCount > 0) {
    reviewStatus = "in_review";
  } else if (failedCount > 0) {
    reviewStatus = "completed_with_failures";
  } else {
    reviewStatus = "completed_all_observed";
  }

  return {
    fixtureId: fixture.id,
    label: fixture.label,
    assessment: fixtureSession?.assessment ?? "pending",
    reviewStatus,
    lastUpdatedAt: fixtureSession?.lastUpdatedAt ?? null,
    totalCheckpoints: checkpoints.length,
    observedCount,
    failedCount,
    pendingCount,
    checkpoints,
  };
}

export function summarizeProofSession(
  fixtures: ReplayFixtureDefinition[],
  session: ReplayProofSession,
): ReplayProofSummary {
  const fixtureSummaries = fixtures.map((fixture) =>
    summarizeFixtureReview(fixture, session),
  );
  const completedFixtureCount = fixtureSummaries.filter(
    (fixture) =>
      fixture.reviewStatus === "completed_all_observed" ||
      fixture.reviewStatus === "completed_with_failures",
  ).length;
  const failedFixtureCount = fixtureSummaries.filter(
    (fixture) => fixture.reviewStatus === "completed_with_failures",
  ).length;
  const pendingFixtureCount = fixtureSummaries.length - completedFixtureCount;

  let overallStatus: ReplayProofSummary["overallStatus"] = "incomplete";

  if (pendingFixtureCount > 0) {
    overallStatus = "incomplete";
  } else if (failedFixtureCount > 0) {
    overallStatus = "completed_with_failures";
  } else {
    overallStatus = "completed_all_observed";
  }

  return {
    activeFixtureId: session.activeFixtureId,
    overallStatus,
    lastUpdatedAt: session.lastUpdatedAt,
    completedFixtureCount,
    failedFixtureCount,
    pendingFixtureCount,
    fixtures: fixtureSummaries,
  };
}

export function buildProofCompactSummary(
  fixtures: ReplayFixtureDefinition[],
  session: ReplayProofSession,
) {
  const summary = summarizeProofSession(fixtures, session);
  const lines = [
    `Proof status: ${summary.overallStatus.replaceAll("_", " ")}`,
    `Active fixture: ${summary.activeFixtureId ?? "none"}`,
    `Completed fixtures: ${summary.completedFixtureCount}/${summary.fixtures.length}`,
    `Failed fixture reviews: ${summary.failedFixtureCount}`,
  ];

  summary.fixtures.forEach((fixture) => {
    lines.push(
      `${fixture.label}: ${fixture.reviewStatus.replaceAll("_", " ")} | observed ${fixture.observedCount} | failed ${fixture.failedCount} | pending ${fixture.pendingCount}`,
    );
  });

  return lines.join("\n");
}

export function buildProofMarkdownSummary(
  fixtures: ReplayFixtureDefinition[],
  session: ReplayProofSession,
) {
  const summary = summarizeProofSession(fixtures, session);
  const lines: string[] = [
    "# CuedUp Replay Proof Summary",
    "",
    `- Overall status: ${summary.overallStatus.replaceAll("_", " ")}`,
    `- Active fixture: ${summary.activeFixtureId ?? "none"}`,
    `- Completed fixtures: ${summary.completedFixtureCount}/${summary.fixtures.length}`,
    `- Failed fixture reviews: ${summary.failedFixtureCount}`,
    `- Last updated: ${summary.lastUpdatedAt ?? "never"}`,
    "",
  ];

  summary.fixtures.forEach((fixture) => {
    lines.push(`## ${fixture.label}`);
    lines.push(`- Review status: ${fixture.reviewStatus.replaceAll("_", " ")}`);
    lines.push(`- Assessment: ${fixture.assessment.replaceAll("_", " ")}`);
    lines.push(`- Last updated: ${fixture.lastUpdatedAt ?? "never"}`);
    lines.push(
      `- Checkpoints: observed ${fixture.observedCount}, failed ${fixture.failedCount}, pending ${fixture.pendingCount}`,
    );
    fixture.checkpoints.forEach((checkpoint) => {
      lines.push(
        `- ${checkpoint.label}: ${checkpoint.status.replaceAll("_", " ")} | updated ${
          checkpoint.lastUpdatedAt ?? "never"
        }${checkpoint.note ? ` | note: ${checkpoint.note}` : ""}`,
      );
    });
    lines.push("");
  });

  return lines.join("\n").trim();
}

export function buildProofJsonSummary(
  fixtures: ReplayFixtureDefinition[],
  session: ReplayProofSession,
) {
  return JSON.stringify(summarizeProofSession(fixtures, session), null, 2);
}
