"use client";

import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Habit {
  id: string;
  title: string;
  pairId: string;
  createdById: string;
  frequency: string;
  createdAt: string;
}

export interface TodayStatus {
  habitId: string;
  date: string;
  you: { status: "DONE" | "MISSED" | "PARTIAL" | null; note: string | null };
  partner: { status: "DONE" | "MISSED" | "PARTIAL" | null; note: string | null };
}

interface Props {
  habit: Habit;
  partnerName: string;
  initialToday: TodayStatus;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  DONE: {
    label: "Done",
    emoji: "✓",
    // Teal for primary positive action
    activeClass: "bg-brand-teal text-white border-brand-teal",
    idleClass:
      "bg-white text-brand-teal border-brand-teal hover:bg-brand-teal/5",
    confirmLabel: "Done ✓",
    confirmClass: "text-brand-teal",
  },
  PARTIAL: {
    label: "Partial",
    emoji: "~",
    // Sage for secondary / in-between state
    activeClass: "bg-brand-sage text-white border-brand-sage",
    idleClass:
      "bg-white text-brand-sage border-brand-sage hover:bg-brand-sage/5",
    confirmLabel: "Partial ~",
    confirmClass: "text-brand-sage",
  },
  MISSED: {
    label: "Missed",
    emoji: "·",
    // Muted warm neutral — not red, not alarming
    activeClass: "bg-stone-400 text-white border-stone-400",
    idleClass:
      "bg-white text-stone-400 border-stone-300 hover:bg-stone-50",
    confirmLabel: "Missed",
    confirmClass: "text-stone-400",
  },
} as const;

type CheckinStatus = keyof typeof STATUS_CONFIG;

// ---------------------------------------------------------------------------
// Partner status line
// ---------------------------------------------------------------------------

function PartnerStatus({
  partnerName,
  status,
  note,
}: {
  partnerName: string;
  status: CheckinStatus | null;
  note: string | null;
}) {
  if (!status) {
    return (
      <p className="text-sm text-gray-400 italic">
        {partnerName} hasn&rsquo;t checked in yet today
      </p>
    );
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-gray-600">
        <span className="font-medium text-brand-text">{partnerName}</span>
        {" checked in: "}
        <span className={`font-medium ${cfg.confirmClass}`}>
          {cfg.confirmLabel}
        </span>
      </p>
      {note && (
        <p className="text-xs text-gray-400 italic pl-1">&ldquo;{note}&rdquo;</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CheckinCard({ habit, partnerName, initialToday }: Props) {
  const [today, setToday] = useState<TodayStatus>(initialToday);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CheckinStatus | null>(null);

  const myStatus = today.you.status;
  const alreadyCheckedIn = myStatus !== null;

  // -------------------------------------------------------------------------
  // Refresh today's data from the server
  // -------------------------------------------------------------------------
  async function refreshToday() {
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/habits/${habit.id}/checkins/today`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (res.ok) {
        const data: TodayStatus = await res.json();
        setToday(data);
      }
    } catch {
      // Non-fatal — stale data is fine; user can refresh the page
    }
  }

  // -------------------------------------------------------------------------
  // Tap a status button
  // -------------------------------------------------------------------------
  function handleStatusTap(status: CheckinStatus) {
    if (alreadyCheckedIn || submitting) return;
    setPendingStatus(status);
    setShowNoteInput(true);
  }

  // -------------------------------------------------------------------------
  // Submit the check-in
  // -------------------------------------------------------------------------
  async function submitCheckin(status: CheckinStatus) {
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/habits/${habit.id}/checkins`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        }
      );

      if (res.status === 409 || res.ok) {
        // 409 = already checked in — treat the same as success: just refresh
        await refreshToday();
        setShowNoteInput(false);
        setPendingStatus(null);
        setNote("");
      } else {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("POST /checkins failed:", err);
      // Surface the error briefly then reset so the user can retry
      setShowNoteInput(false);
      setPendingStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelNote() {
    setShowNoteInput(false);
    setPendingStatus(null);
    setNote("");
  }

  // -------------------------------------------------------------------------
  // Render: confirmed state
  // -------------------------------------------------------------------------
  if (alreadyCheckedIn) {
    const cfg = STATUS_CONFIG[myStatus];
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
        {/* Habit title */}
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Today&rsquo;s habit</p>
          <h2 className="text-lg font-semibold text-brand-text">{habit.title}</h2>
        </div>

        {/* Your confirmed status */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-tint border border-gray-100">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${cfg.activeClass}`}
          >
            {cfg.emoji}
          </div>
          <div>
            <p className="text-sm font-medium text-brand-text">
              You checked in:{" "}
              <span className={cfg.confirmClass}>{cfg.confirmLabel}</span>
            </p>
            {today.you.note && (
              <p className="text-xs text-gray-400 italic mt-0.5">
                &ldquo;{today.you.note}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Partner status */}
        <div className="pl-1">
          <PartnerStatus
            partnerName={partnerName}
            status={today.partner.status}
            note={today.partner.note}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: note input state
  // -------------------------------------------------------------------------
  if (showNoteInput && pendingStatus) {
    const cfg = STATUS_CONFIG[pendingStatus];
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Today&rsquo;s habit</p>
          <h2 className="text-lg font-semibold text-brand-text">{habit.title}</h2>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Marking as{" "}
            <span className={`font-medium ${cfg.confirmClass}`}>
              {cfg.confirmLabel}
            </span>
            . Add a note? <span className="text-gray-400">(optional)</span>
          </p>
          <textarea
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal/30 placeholder-gray-300"
            rows={2}
            placeholder="How did it go?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => submitCheckin(pendingStatus)}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-brand-teal text-white text-sm font-medium hover:bg-brand-teal/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save check-in"}
          </button>
          <button
            onClick={cancelNote}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        </div>

        {/* Partner status visible even on note screen */}
        <div className="pl-1 pt-1 border-t border-gray-50">
          <PartnerStatus
            partnerName={partnerName}
            status={today.partner.status}
            note={today.partner.note}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: tap-to-check-in state
  // -------------------------------------------------------------------------
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
      {/* Habit title */}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Today&rsquo;s habit</p>
        <h2 className="text-lg font-semibold text-brand-text">{habit.title}</h2>
      </div>

      {/* Status buttons */}
      <div>
        <p className="text-sm text-gray-500 mb-3">How did today go?</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(STATUS_CONFIG) as CheckinStatus[]).map((status) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <button
                key={status}
                onClick={() => handleStatusTap(status)}
                disabled={submitting}
                className={`py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${cfg.idleClass}`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Partner status */}
      <div className="pl-1 border-t border-gray-50 pt-4">
        <PartnerStatus
          partnerName={partnerName}
          status={today.partner.status}
          note={today.partner.note}
        />
      </div>
    </div>
  );
}
