import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const name = session.user.name ?? session.user.email ?? "there";
  const email = session.user.email ?? "";

  // Get the access token from the session
  // @ts-expect-error - tokenSet exists but isn't in the public type
  const token = session.tokenSet?.accessToken;

  if (!token) {
    console.error("No access token in session:", session);
    return (
      <DashboardClient
        name={name}
        email={email}
        pairs={[]}
        pairError="No access token found — please log out and log in again"
      />
    );
  }

  // Fetch the user's pair status server-side
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

  return <DashboardClient name={name} email={email} pairs={pairs} pairError={pairError} />;
}
