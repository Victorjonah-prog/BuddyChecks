"use client";

import { getAccessToken } from "@auth0/nextjs-auth0";
import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  email: string;
}

type SyncState = "idle" | "syncing" | "done" | "error";

export default function HomeClient({ name, email }: Props) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  // Guard against double-firing in React strict mode / re-renders
  const hasSynced = useRef(false);

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    async function syncUser() {
      setSyncState("syncing");
      try {
        // getAccessToken() calls the SDK's /auth/access-token route,
        // which returns the audience-scoped token from the session.
        const token = await getAccessToken();

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name, email }),
          }
        );

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

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-semibold">Welcome, {name}!</h1>

      {syncState === "syncing" && (
        <p className="text-sm text-gray-400">Syncing your account…</p>
      )}
      {syncState === "error" && (
        <p className="text-sm text-red-500">Sync failed: {syncError}</p>
      )}

      <a
        href="/auth/logout"
        className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Log Out
      </a>
    </div>
  );
}
