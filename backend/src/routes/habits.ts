import { FastifyInstance } from "fastify";
import { verifyAuth } from "../plugins/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the caller's User record and their single active Pair in one shot.
 * Returns null for user if not synced, null for pair if not yet paired.
 */
async function getCallerWithActivePair(app: FastifyInstance, auth0Id: string) {
  const caller = await app.prisma.user.findUnique({
    where: { auth0Id },
  });

  if (!caller) return { caller: null, pair: null };

  const pair = await app.prisma.pair.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ userAId: caller.id }, { userBId: caller.id }],
    },
  });

  return { caller, pair };
}

/**
 * Returns the date portion of "now" as a JS Date with time zeroed to midnight
 * UTC. Stored as @db.Date in Postgres, so the time component is irrelevant —
 * but keeping it at midnight avoids any timezone confusion when comparing.
 */
function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

const VALID_DURATIONS = ["1_WEEK", "2_WEEKS", "1_MONTH", "3_MONTHS", "ONGOING"] as const;
type Duration = typeof VALID_DURATIONS[number];

/**
 * Converts a client-supplied duration enum to an absolute endDate computed
 * server-side, or null for ONGOING. Never trusts a client-provided date.
 */
function endDateFromDuration(duration: Duration): Date | null {
  const now = todayUTC();
  switch (duration) {
    case "1_WEEK":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "2_WEEKS":
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case "1_MONTH": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
    }
    case "3_MONTHS": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() + 3);
      return d;
    }
    case "ONGOING":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function habitRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // POST /habits — create a habit for the caller's active pair
  // -------------------------------------------------------------------------
  app.post("/habits", { preHandler: verifyAuth }, async (request, reply) => {
    const { caller, pair } = await getCallerWithActivePair(app, request.auth0Id);

    if (!caller) {
      return reply.code(404).send({ error: "User not found — call POST /sync first" });
    }

    if (!pair) {
      return reply.code(400).send({ error: "You need a pair before creating a habit" });
    }

    // Validate body
    const body = request.body as Record<string, unknown>;
    const { title, duration } = body ?? {};

    if (typeof title !== "string" || title.trim() === "") {
      return reply.code(400).send({ error: "title is required and must be a non-empty string" });
    }

    // duration is optional — defaults to ONGOING if omitted
    const resolvedDuration: Duration =
      VALID_DURATIONS.includes(duration as Duration)
        ? (duration as Duration)
        : "ONGOING";

    const endDate = endDateFromDuration(resolvedDuration);

    const habit = await app.prisma.habit.create({
      data: {
        title: title.trim(),
        pairId: pair.id,
        createdById: caller.id,
        frequency: "DAILY",
        status: "ACTIVE",
        endDate,
      },
    });

    return reply.code(201).send(habit);
  });

  // -------------------------------------------------------------------------
  // GET /habits/me — return all habits for the caller's active pair
  //
  // Lazy expiry: if any ACTIVE habit's endDate has passed, mark it ENDED
  // before returning. No cron job needed for MVP.
  //
  // NOTE: this route must be registered before /habits/:habitId/checkins
  // so Fastify matches the literal segment "me" first.
  // -------------------------------------------------------------------------
  app.get("/habits/me", { preHandler: verifyAuth }, async (request, reply) => {
    const { caller, pair } = await getCallerWithActivePair(app, request.auth0Id);

    if (!caller) {
      return reply.code(404).send({ error: "User not found — call POST /sync first" });
    }

    if (!pair) {
      return reply.code(400).send({ error: "You need a pair before viewing habits" });
    }

    const habits = await app.prisma.habit.findMany({
      where: { pairId: pair.id },
      orderBy: { createdAt: "asc" },
    });

    const now = todayUTC();

    // Collect habits that are still ACTIVE but whose endDate has passed
    const expiredIds = habits
      .filter((h) => h.status === "ACTIVE" && h.endDate !== null && h.endDate < now)
      .map((h) => h.id);

    if (expiredIds.length > 0) {
      await app.prisma.habit.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: "ENDED" },
      });

      // Reflect the update in the objects we're about to return
      for (const h of habits) {
        if (expiredIds.includes(h.id)) {
          (h as { status: string }).status = "ENDED";
        }
      }
    }

    return habits;
  });

  // -------------------------------------------------------------------------
  // POST /habits/:habitId/checkins — create today's check-in for the caller
  // -------------------------------------------------------------------------
  app.post<{ Params: { habitId: string } }>(
    "/habits/:habitId/checkins",
    { preHandler: verifyAuth },
    async (request, reply) => {
      const { habitId } = request.params;

      const { caller, pair } = await getCallerWithActivePair(app, request.auth0Id);

      if (!caller) {
        return reply.code(404).send({ error: "User not found — call POST /sync first" });
      }

      // Load the habit and verify it belongs to the caller's pair
      const habit = await app.prisma.habit.findUnique({
        where: { id: habitId },
      });

      if (!habit) {
        return reply.code(404).send({ error: "Habit not found" });
      }

      // The caller must be in the pair that owns this habit
      if (!pair || habit.pairId !== pair.id) {
        return reply.code(403).send({ error: "You are not a member of the pair that owns this habit" });
      }

      // Reject check-ins on ended habits
      if (habit.status === "ENDED") {
        return reply.code(400).send({ error: "This habit has ended" });
      }

      // Validate body
      const body = request.body as Record<string, unknown>;
      const { status, note } = body ?? {};

      const validStatuses = ["DONE", "MISSED", "PARTIAL"] as const;
      type CheckinStatus = typeof validStatuses[number];

      if (!validStatuses.includes(status as CheckinStatus)) {
        return reply.code(400).send({
          error: `status is required and must be one of: ${validStatuses.join(", ")}`,
        });
      }

      if (note !== undefined && typeof note !== "string") {
        return reply.code(400).send({ error: "note must be a string if provided" });
      }

      const today = todayUTC();

      // Attempt to create — catch the unique constraint violation cleanly
      try {
        const checkin = await app.prisma.checkin.create({
          data: {
            habitId,
            userId: caller.id,
            date: today,
            status: status as CheckinStatus,
            note: typeof note === "string" ? note.trim() || null : null,
          },
        });

        return reply.code(201).send(checkin);
      } catch (err: unknown) {
        // Prisma error code P2002 = unique constraint violation
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          return reply.code(409).send({ error: "You've already checked in today" });
        }
        throw err; // let Fastify's error handler deal with anything else
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /habits/:habitId/checkins/today — both partners' check-in status
  // -------------------------------------------------------------------------
  app.get<{ Params: { habitId: string } }>(
    "/habits/:habitId/checkins/today",
    { preHandler: verifyAuth },
    async (request, reply) => {
      const { habitId } = request.params;

      const { caller, pair } = await getCallerWithActivePair(app, request.auth0Id);

      if (!caller) {
        return reply.code(404).send({ error: "User not found — call POST /sync first" });
      }

      // Load the habit and verify ownership
      const habit = await app.prisma.habit.findUnique({
        where: { id: habitId },
      });

      if (!habit) {
        return reply.code(404).send({ error: "Habit not found" });
      }

      if (!pair || habit.pairId !== pair.id) {
        return reply.code(403).send({ error: "You are not a member of the pair that owns this habit" });
      }

      // Identify the partner
      const partnerId = pair.userAId === caller.id ? pair.userBId : pair.userAId;

      const today = todayUTC();

      // Fetch both check-ins in one query
      const checkins = await app.prisma.checkin.findMany({
        where: {
          habitId,
          date: today,
          userId: { in: [caller.id, partnerId] },
        },
        select: {
          userId: true,
          status: true,
          note: true,
        },
      });

      const callerCheckin = checkins.find((c) => c.userId === caller.id) ?? null;
      const partnerCheckin = checkins.find((c) => c.userId === partnerId) ?? null;

      return {
        habitId,
        date: today.toISOString().slice(0, 10), // "YYYY-MM-DD"
        you: {
          status: callerCheckin?.status ?? null,
          note: callerCheckin?.note ?? null,
        },
        partner: {
          status: partnerCheckin?.status ?? null,
          note: partnerCheckin?.note ?? null,
        },
      };
    }
  );
}
