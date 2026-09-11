import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { Habit, TodayStatus } from "./CheckinCard";

export default async function DashboardPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const name = session.user.name ?? session.user.email ?? "there";
  const email = session.user.email ?? "";

  // Get the access token from the session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (session as any).tokenSet?.accessToken;

  if (!token) {
    console.error("No access token in session:", session);
    return (
      <DashboardClient
        name={name}
        email={email}
        pairs={[]}
        pairError="No access token found — please log out and log in again"
        initialHabits={[]}
        initialToday={null}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Fetch pair status
  // ---------------------------------------------------------------------------
  let pairs: Array<{ id: string; partner: { name: string } }> = [];
  let pairError: string | null = null;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pairs/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.ok) {
      pairs = await res.json();
    } else {
      const body = await res.text();
      console.error(`GET /pairs/me failed (${res.status}):`, body);
      pairError = `Failed to load pair status (HTTP ${res.status})`;
    }
  } catch (err) {
    console.error("Error fetching pairs:", err);
    pairError = err instanceof Error ? err.message : "Unknown error";
  }

  // ---------------------------------------------------------------------------
  // Fetch habits (only if paired)
  // ---------------------------------------------------------------------------
  let initialHabits: Habit[] = [];
  let initialToday: TodayStatus | null = null;

  if (pairs.length > 0) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/habits/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.ok) {
        initialHabits = await res.json();
      } else {
        // Non-fatal: missing habits just means the create-form is shown
        console.error(`GET /habits/me failed (${res.status})`);
      }
    } catch (err) {
      console.error("Error fetching habits:", err);
    }

    // -------------------------------------------------------------------------
    // Fetch today's check-in status for the first habit (if one exists)
    // -------------------------------------------------------------------------
    if (initialHabits.length > 0) {
      try {
        const habitId = initialHabits[0].id;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/habits/${habitId}/checkins/today`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );

        if (res.ok) {
          initialToday = await res.json();
        } else {
          console.error(`GET /habits/${habitId}/checkins/today failed (${res.status})`);
        }
      } catch (err) {
        console.error("Error fetching today's check-in:", err);
      }
    }
  }

  return (
    <DashboardClient
      name={name}
      email={email}
      pairs={pairs}
      pairError={pairError}
      initialHabits={initialHabits}
      initialToday={initialToday}
    />
  );
}
