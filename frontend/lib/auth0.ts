import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: "openid profile email offline_access",
  },

  // Verbose error hook: logs the real error to the server terminal and
  // returns a plain-text 500 that includes the error name + message so
  // you can see the actual cause in the browser during development.
  // Remove or replace with a proper error page before going to production.
  async onCallback(error, ctx, session) {
    if (error) {
      console.error("[Auth0 callback error]", error);
      return new NextResponse(
        `Auth0 callback error (${error.name}): ${error.message}`,
        { status: 500 }
      );
    }
    const appBaseUrl = ctx.appBaseUrl;
    return NextResponse.redirect(
      new URL(ctx.returnTo ?? "/", appBaseUrl).toString()
    );
  },
});
