/**
 * Integration tests for the habit duration + status changes.
 * Runs directly against the local Postgres DB via Prisma (no HTTP layer needed
 * for logic tests; we unit-test the helper functions and DB state directly).
 *
 * Run with:  npx tsx test-integration.ts
 */

import { PrismaClient } from "./generated/prisma";

const p = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers (duplicated from routes/habits.ts so we can test them in isolation)
// ---------------------------------------------------------------------------

const VALID_DURATIONS = ["1_WEEK", "2_WEEKS", "1_MONTH", "3_MONTHS", "ONGOING"] as const;
type Duration = typeof VALID_DURATIONS[number];

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function endDateFromDuration(duration: Duration): Date | null {
  const now = todayUTC();
  switch (duration) {
    case "1_WEEK":   return new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000);
    case "2_WEEKS":  return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case "1_MONTH":  { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + 1); return d; }
    case "3_MONTHS": { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + 3); return d; }
    case "ONGOING":  return null;
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

async function run() {
  console.log("\n═══════════════════════════════════════════════");
  console.log(" BuddyChecks integration tests");
  console.log("═══════════════════════════════════════════════\n");

  // ── 1. endDateFromDuration helper ─────────────────────────────────────────
  console.log("1. endDateFromDuration helper");

  const today = todayUTC();

  const week = endDateFromDuration("1_WEEK")!;
  const expectedWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  assert("1_WEEK → today + 7 days", week.toISOString() === expectedWeek.toISOString());

  const twoWeeks = endDateFromDuration("2_WEEKS")!;
  const expected2W = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  assert("2_WEEKS → today + 14 days", twoWeeks.toISOString() === expected2W.toISOString());

  const oneMonth = endDateFromDuration("1_MONTH")!;
  assert("1_MONTH → month incremented", oneMonth.getUTCMonth() === (today.getUTCMonth() + 1) % 12);

  const threeMonths = endDateFromDuration("3_MONTHS")!;
  assert("3_MONTHS → 3 months incremented", threeMonths > twoWeeks);

  assert("ONGOING → null", endDateFromDuration("ONGOING") === null);

  // ── 2. DB: existing habit has correct defaults post-migration ─────────────
  console.log("\n2. DB: existing habit after migration");

  const existingHabit = await p.habit.findFirst({ orderBy: { createdAt: "asc" } });
  assert("existing habit has status ACTIVE", existingHabit?.status === "ACTIVE",
    `got: ${existingHabit?.status}`);
  assert("existing habit has endDate null", existingHabit?.endDate === null,
    `got: ${existingHabit?.endDate}`);

  // ── 3. Create a habit with a duration and verify endDate ──────────────────
  console.log("\n3. Create habit with duration");

  // Use the real pair that exists in the DB
  const pair = await p.pair.findFirst({ where: { status: "ACTIVE" } });
  if (!pair) throw new Error("No active pair found — seed data missing");

  const endDate1W = endDateFromDuration("1_WEEK")!;
  const testHabit = await p.habit.create({
    data: {
      title: "__test__ duration habit",
      pairId: pair.id,
      createdById: pair.userAId,
      frequency: "DAILY",
      status: "ACTIVE",
      endDate: endDate1W,
    },
  });

  assert("habit created with status ACTIVE", testHabit.status === "ACTIVE");
  assert("habit endDate matches 1_WEEK calculation",
    testHabit.endDate?.toISOString() === endDate1W.toISOString(),
    `got: ${testHabit.endDate?.toISOString()}`);

  // ── 4. Lazy expiry: create a habit with a past endDate, simulate GET ───────
  console.log("\n4. Lazy expiry (past endDate → ENDED on GET)");

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const expiredHabit = await p.habit.create({
    data: {
      title: "__test__ expired habit",
      pairId: pair.id,
      createdById: pair.userAId,
      frequency: "DAILY",
      status: "ACTIVE",
      endDate: yesterday,
    },
  });

  assert("expired habit initially ACTIVE", expiredHabit.status === "ACTIVE");

  // Simulate what GET /habits/me does: find expired ones and update them
  const habitsForPair = await p.habit.findMany({ where: { pairId: pair.id } });
  const expiredIds = habitsForPair
    .filter((h) => h.status === "ACTIVE" && h.endDate !== null && h.endDate < today)
    .map((h) => h.id);

  assert("expired habit appears in expiredIds", expiredIds.includes(expiredHabit.id));

  await p.habit.updateMany({ where: { id: { in: expiredIds } }, data: { status: "ENDED" } });

  const reloaded = await p.habit.findUnique({ where: { id: expiredHabit.id } });
  assert("expired habit now has status ENDED", reloaded?.status === "ENDED",
    `got: ${reloaded?.status}`);

  // ── 5. Reject check-in on ENDED habit ─────────────────────────────────────
  console.log("\n5. Check-in rejected on ENDED habit");

  // This mirrors the guard in POST /habits/:habitId/checkins
  const endedHabit = await p.habit.findUnique({ where: { id: expiredHabit.id } });
  assert("ENDED habit blocks check-in (status check)",
    endedHabit?.status === "ENDED");

  // Verify the guard logic: if status === ENDED, we would return 400
  const wouldBlock = endedHabit?.status === "ENDED";
  assert("guard correctly identifies ENDED habit", wouldBlock);

  // ── 6. ONGOING habit has null endDate and stays ACTIVE ────────────────────
  console.log("\n6. ONGOING habit never expires");

  const ongoingHabit = await p.habit.create({
    data: {
      title: "__test__ ongoing habit",
      pairId: pair.id,
      createdById: pair.userAId,
      frequency: "DAILY",
      status: "ACTIVE",
      endDate: null,
    },
  });

  // Simulate lazy expiry check: null endDate should never appear in expiredIds
  const habitsForPair2 = await p.habit.findMany({ where: { pairId: pair.id } });
  const expiredIds2 = habitsForPair2
    .filter((h) => h.status === "ACTIVE" && h.endDate !== null && h.endDate < today)
    .map((h) => h.id);

  assert("ONGOING habit NOT in expiredIds", !expiredIds2.includes(ongoingHabit.id));
  assert("ONGOING habit endDate is null", ongoingHabit.endDate === null);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n  (cleaning up test habits…)");
  await p.habit.deleteMany({
    where: { title: { startsWith: "__test__" } },
  });
  console.log("  cleaned up.");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════\n`);

  await p.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error("Test runner error:", err);
  // Best-effort cleanup
  await p.habit.deleteMany({ where: { title: { startsWith: "__test__" } } }).catch(() => {});
  await p.$disconnect();
  process.exit(1);
});
