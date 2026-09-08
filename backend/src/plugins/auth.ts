import { FastifyRequest, FastifyReply } from "fastify";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";

// ---------------------------------------------------------------------------
// JWKS client — created once, cached for the lifetime of the process.
// Fetches public keys from Auth0's discovery endpoint and caches them.
// ---------------------------------------------------------------------------

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const domain = process.env.AUTH0_DOMAIN;
    if (!domain) throw new Error("AUTH0_DOMAIN is not set");
    jwks = createRemoteJWKSet(
      new URL(`https://${domain}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

// ---------------------------------------------------------------------------
// Augment FastifyRequest so TypeScript knows about request.auth0Id
// ---------------------------------------------------------------------------

declare module "fastify" {
  interface FastifyRequest {
    auth0Id: string;
  }
}

// ---------------------------------------------------------------------------
// verifyAuth — call this inside any route that requires authentication.
//
// Usage:
//   fastify.get("/me", async (req, reply) => {
//     await verifyAuth(req, reply);
//     // req.auth0Id is now available
//   });
//
// Or as a preHandler on a route/plugin:
//   { preHandler: verifyAuth }
// ---------------------------------------------------------------------------

export async function verifyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  const audience = process.env.AUTH0_AUDIENCE;
  const domain = process.env.AUTH0_DOMAIN;

  if (!audience || !domain) {
    request.log.error("AUTH0_AUDIENCE or AUTH0_DOMAIN is not configured");
    return reply.code(500).send({ error: "Server auth configuration error" });
  }

  let payload: JWTPayload;
  try {
    const { payload: verified } = await jwtVerify(token, getJwks(), {
      audience,
      issuer: `https://${domain}/`,
    });
    payload = verified;
  } catch (err) {
    request.log.warn({ err }, "JWT verification failed");
    return reply.code(401).send({ error: "Invalid or expired token" });
  }

  if (!payload.sub) {
    return reply.code(401).send({ error: "Token missing sub claim" });
  }

  request.auth0Id = payload.sub;
}
