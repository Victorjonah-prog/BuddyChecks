"use client";

import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  email: string;
  pairs: Array<{ id: string; partner: { name: string } }>;
  pairError: string | null;
}

type SyncState = "idle" | "syncing" | "done" | "error";
type InviteState = "idle" | "creating" | "created" | "error";

export default function DashboardClient({ name, email, pairs, pairError }: Props) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasSynced = useRef(false);

  const [inviteState, setInviteState] = useState<InviteState>("idle");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activePair = pairs.length > 0 ? pairs[0] : null;

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    async function syncUser() {
      setSyncState("syncing");
      try {
        const token = await getAccessToken();

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, email }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        setSyncState("done");
      } catch (err) {
        console.error("POST /sync failed:", err);
        setSyncError(err instanceof Error ? err.message : "Unknown error");
        setSyncState("error");
      }
    }

    syncUser();
  }, [name, email]);

  async function createInvite() {
    setInviteState("creating");
    setInviteError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInviteCode(data.code);
      setInviteState("created");
    } catch (err) {
      console.error("POST /invites failed:", err);
      setInviteError(err instanceof Error ? err.message : "Unknown error");
      setInviteState("error");
    }
  }

  function copyLink() {
    if (!inviteCode) return;
    const link = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-tint">
      {/* Header */}
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold text-brand-text">
            BuddyChecks
          </a>
          <a
            href="/auth/logout"
            className="text-sm text-gray-600 hover:text-brand-teal transition-colors"
          >
            Log out
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-semibold text-brand-text mb-2">
            Welcome, {name}!
          </h1>

          {syncState === "syncing" && (
            <p className="text-sm text-gray-400 mb-6">Syncing your account…</p>
          )}
          {syncState === "error" && (
            <p className="text-sm text-red-500 mb-6">Sync failed: {syncError}</p>
          )}

          <hr className="my-6 border-gray-100" />

          {/* Error loading pair status */}
          {pairError && (
            <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm mb-6">
              {pairError}
            </div>
          )}

          {/* Already paired */}
          {activePair && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-brand-text">Your pair</h2>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-tint border border-brand-sage/20">
                <div className="w-10 h-10 rounded-full bg-brand-sage flex items-center justify-center text-white font-semibold text-sm">
                  {activePair.partner.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-brand-text">
                    {activePair.partner.name}
                  </p>
                  <p className="text-sm text-gray-500">Your accountability buddy</p>
                </div>
              </div>
            </div>
          )}

          {/* Not paired yet */}
          {!activePair && !pairError && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-brand-text">Get started</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                You&rsquo;re not paired yet. Create an invite link and share it with
                a friend to start your accountability journey together.
              </p>

              {inviteState === "idle" && (
                <button
                  onClick={createInvite}
                  className="px-6 py-2.5 rounded-lg bg-brand-teal text-white font-medium text-sm hover:bg-brand-sage transition-colors"
                >
                  Create an invite
                </button>
              )}

              {inviteState === "creating" && (
                <p className="text-sm text-gray-400">Creating invite…</p>
              )}

              {inviteState === "error" && (
                <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">
                  {inviteError}
                </div>
              )}

              {inviteState === "created" && inviteCode && (
                <div className="space-y-3 p-4 rounded-xl bg-brand-tint border border-brand-teal/20">
                  <p className="text-sm font-medium text-brand-text">
                    Share this link with your buddy:
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-mono text-brand-teal hover:bg-gray-50 transition-colors truncate"
                    >
                      {typeof window !== "undefined" ? window.location.origin : ""}/invite/{inviteCode}
                    </a>
                    <button
                      onClick={copyLink}
                      className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-brand-sage transition-colors shrink-0"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
