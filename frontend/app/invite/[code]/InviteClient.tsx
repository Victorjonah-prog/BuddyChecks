"use client";

import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

interface Props {
  code: string;
  invite: { code: string; status: string; inviterName: string } | null;
  inviteError: string | null;
  isLoggedIn: boolean;
}

type AcceptState = "idle" | "accepting" | "error";

export default function InviteClient({ code, invite, inviteError, isLoggedIn }: Props) {
  const router = useRouter();
  const [acceptState, setAcceptState] = useState<AcceptState>("idle");
  const [acceptError, setAcceptError] = useState<string | null>(null);

  async function acceptInvite() {
    setAcceptState("accepting");
    setAcceptError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/invites/${code}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        // Successfully paired — redirect to dashboard
        router.push("/dashboard");
        return;
      }

      // Handle known error cases
      const body = await res.json().catch(() => ({}));
      const errorMsg = body.error ?? `HTTP ${res.status}`;

      if (res.status === 400) {
        if (errorMsg.includes("already paired")) {
          setAcceptError("You're already paired with someone else.");
        } else if (errorMsg.includes("cannot accept your own")) {
          setAcceptError("You can't accept your own invite.");
        } else {
          setAcceptError(errorMsg);
        }
      } else if (res.status === 404) {
        setAcceptError("This invite no longer exists.");
      } else if (res.status === 410) {
        setAcceptError("This invite has already been used or expired.");
      } else {
        setAcceptError(errorMsg);
      }

      setAcceptState("error");
    } catch (err) {
      console.error("POST /invites/:code/accept failed:", err);
      setAcceptError(err instanceof Error ? err.message : "Unknown error");
      setAcceptState("error");
    }
  }

  function loginWithReturn() {
    window.location.href = `/auth/login?returnTo=${encodeURIComponent(`/invite/${code}`)}`;
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-tint">
      {/* Header */}
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Image
              src="/buddychecks-icon.svg"
              alt=""
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="font-semibold text-lg text-brand-text">
              BuddyChecks
            </span>
          </a>
          {isLoggedIn && (
            <a
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-brand-teal transition-colors"
            >
              Dashboard
            </a>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-md mx-auto px-6 py-12 flex items-center justify-center">
        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Error loading invite */}
          {inviteError && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-brand-text">
                {inviteError === "Invite not found"
                  ? "Invite not found"
                  : "Invalid invite"}
              </h1>
              <p className="text-sm text-gray-600">{inviteError}</p>
              <a
                href="/"
                className="inline-block mt-4 px-6 py-2 rounded-lg bg-brand-teal text-white text-sm font-medium hover:bg-brand-sage transition-colors"
              >
                Go home
              </a>
            </div>
          )}

          {/* Valid invite */}
          {invite && !inviteError && (
            <div className="space-y-6 text-center">
              {/* Decorative icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-tint flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-brand-teal"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>

              <div>
                <h1 className="text-xl font-semibold text-brand-text mb-2">
                  {invite.inviterName} invited you to BuddyChecks
                </h1>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Pair up to support each other with daily habits — no judgment, just
                  gentle accountability.
                </p>
              </div>

              {/* Not logged in */}
              {!isLoggedIn && (
                <button
                  onClick={loginWithReturn}
                  className="w-full px-6 py-3 rounded-lg bg-brand-teal text-white font-medium hover:bg-brand-sage transition-colors"
                >
                  Log in to accept
                </button>
              )}

              {/* Logged in */}
              {isLoggedIn && (
                <div className="space-y-3">
                  {acceptState === "idle" && (
                    <button
                      onClick={acceptInvite}
                      className="w-full px-6 py-3 rounded-lg bg-brand-teal text-white font-medium hover:bg-brand-sage transition-colors"
                    >
                      Accept invite
                    </button>
                  )}

                  {acceptState === "accepting" && (
                    <div className="py-3 text-sm text-gray-400">
                      Accepting invite…
                    </div>
                  )}

                  {acceptState === "error" && acceptError && (
                    <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm text-left">
                      {acceptError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
