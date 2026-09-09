import { auth0 } from "@/lib/auth0";
import HomeClient from "./HomeClient";
import Image from "next/image";

// Server Component: reads the session on the server and passes it down.
// getSession() is free here — no extra network call, just decrypts the cookie.
export default async function Home() {
  const session = await auth0.getSession();

  if (session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <HomeClient
          name={session.user.name ?? session.user.email ?? "there"}
          email={session.user.email ?? ""}
        />
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]" style={{ color: "#1a1a1a" }}>

      {/* ── Header ── */}
      <header className="w-full border-b border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Use icon mark + wordmark text so the logo reads clearly at nav height.
              The stacked SVG lockup (icon above wordmark) needs ~128px to be
              legible; icon.svg is designed for compact spaces exactly like this. */}
          <a href="/" className="flex items-center gap-2.5" aria-label="BuddyChecks home">
            <Image
              src="/buddychecks-icon.svg"
              alt=""
              width={40}
              height={40}
              priority
              className="h-10 w-10 shrink-0"
            />
            <span
              className="font-semibold text-lg leading-none tracking-tight"
              style={{ color: "#1a1a1a" }}
            >
              BuddyChecks
            </span>
          </a>
          <a
            href="/auth/login"
            className="text-sm font-medium text-brand-teal hover:text-brand-sage transition-colors"
          >
            Log in
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-brand-tint">
        <div className="max-w-5xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-6">
          {/* Decorative pair-of-checks motif */}
          <div className="flex items-center gap-1 mb-2" aria-hidden="true">
            <CheckmarkIcon color="#0f9488" size={28} />
            <CheckmarkIcon color="#84a98c" size={28} />
          </div>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight max-w-2xl">
            Show up for yourself.
            <br />
            <span className="text-brand-teal">With someone who gets it.</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl leading-relaxed">
            BuddyChecks pairs you with one trusted person to keep a small daily
            habit alive — no leaderboards, no streaks to protect, no judgment
            for off days.
          </p>

          {/* Plain <a> avoids Next.js prefetch writing a transaction cookie */}
          <a
            href="/auth/login"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-teal px-8 py-3 text-white font-medium text-base hover:bg-brand-sage transition-colors shadow-sm"
          >
            Get started — it&rsquo;s free
          </a>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-semibold text-center mb-12" style={{ color: "#1a1a1a" }}>
            How it works
          </h2>

          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col items-center text-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                  style={{ backgroundColor: "#0f9488" }}
                >
                  {i + 1}
                </div>
                <h3 className="font-semibold text-base" style={{ color: "#1a1a1a" }}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Philosophy ── */}
      <section className="bg-brand-tint">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          {/* Visual accent: two overlapping circles */}
          <div className="flex justify-center mb-8" aria-hidden="true">
            <div className="flex -space-x-3">
              <div className="w-12 h-12 rounded-full border-2 border-white" style={{ backgroundColor: "#0f9488", opacity: 0.85 }} />
              <div className="w-12 h-12 rounded-full border-2 border-white" style={{ backgroundColor: "#84a98c", opacity: 0.85 }} />
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-4" style={{ color: "#1a1a1a" }}>
            Not another streak app.
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-6">
            Most habit apps treat a missed day as a failure — broken streaks,
            red Xs, the quiet pressure to perform. BuddyChecks works differently.
          </p>
          <div
            className="rounded-2xl p-8 text-left space-y-4 shadow-sm"
            style={{ backgroundColor: "#ffffff" }}
          >
            {PRINCIPLES.map((p) => (
              <div key={p.label} className="flex items-start gap-3">
                <span
                  className="mt-1 w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: "#f0f5f3" }}
                  aria-hidden="true"
                >
                  <SmallCheck color="#0f9488" />
                </span>
                <div>
                  <span className="font-medium text-sm" style={{ color: "#1a1a1a" }}>{p.label}</span>
                  <span className="text-sm text-gray-500"> — {p.body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col items-center gap-3">
          <Image
            src="/buddychecks-icon.svg"
            alt="BuddyChecks"
            width={32}
            height={32}
            className="w-8 h-8 opacity-70"
          />
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} BuddyChecks. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Pair up with a friend",
    body: "Invite one person you trust — a close friend, a partner, or someone working toward the same thing.",
  },
  {
    title: "Choose a habit together",
    body: "Pick something small and sustainable. A ten-minute walk, a journal entry, five minutes of breathing.",
  },
  {
    title: "Check in once a day",
    body: "A single tap to say you showed up. You can send a short note of encouragement — nothing more required.",
  },
];

const PRINCIPLES = [
  {
    label: "No shame for missed days",
    body: "Off days are part of the process. The app never punishes you for them.",
  },
  {
    label: "No competitive pressure",
    body: "There are no leaderboards, scores, or comparisons — just you, your buddy, and your habit.",
  },
  {
    label: "Encouragement, not surveillance",
    body: "Your buddy can cheer you on, but this isn't about accountability through judgment.",
  },
];

// ── Inline SVG helpers ───────────────────────────────────────────────────────

function CheckmarkIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 12 9 17 20 6" />
    </svg>
  );
}

function SmallCheck({ color }: { color: string }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 12 12"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1.5 6 4.5 9 10.5 3" />
    </svg>
  );
}
