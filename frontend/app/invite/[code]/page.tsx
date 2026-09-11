import { auth0 } from "@/lib/auth0";
import InviteClient from "./InviteClient";

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth0.getSession();

  // Fetch invite info (public endpoint, no auth needed)
  let invite: { code: string; status: string; inviterName: string } | null = null;
  let inviteError: string | null = null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/invites/${code}`,
      { cache: "no-store" }
    );

    if (res.ok) {
      invite = await res.json();
    } else if (res.status === 404) {
      inviteError = "Invite not found";
    } else if (res.status === 410) {
      const body = await res.json().catch(() => ({}));
      inviteError = body.error ?? "This invite is no longer valid";
    } else {
      inviteError = `Failed to load invite (HTTP ${res.status})`;
    }
  } catch (err) {
    inviteError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <InviteClient
      code={code}
      invite={invite}
      inviteError={inviteError}
      isLoggedIn={!!session}
      userName={session?.user.name ?? session?.user.email}
      userEmail={session?.user.email}
    />
  );
}
