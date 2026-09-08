import { auth0 } from "@/lib/auth0";
import HomeClient from "./HomeClient";

// Server Component: reads the session on the server and passes it down.
// getSession() is free here — no extra network call, just decrypts the cookie.
export default async function Home() {
  const session = await auth0.getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      {session ? (
        <HomeClient
          name={session.user.name ?? session.user.email ?? "there"}
          email={session.user.email ?? ""}
        />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold">BuddyChecks</h1>
          <p className="text-gray-500">Track habits with a partner.</p>
          {/* Plain <a> to avoid Next.js FULL prefetch writing a transaction cookie */}
          <a
            href="/auth/login"
            className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 transition-colors"
          >
            Log In
          </a>
        </div>
      )}
    </main>
  );
}
