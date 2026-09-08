import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "../generated/prisma";
import { verifyAuth } from "./plugins/auth";

// ---------------------------------------------------------------------------
// Augment FastifyInstance so TypeScript knows about fastify.prisma
// ---------------------------------------------------------------------------

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// ---------------------------------------------------------------------------
// Build the Fastify app (exported for testing)
// ---------------------------------------------------------------------------

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    },
  });

  // -------------------------------------------------------------------------
  // CORS — allow the Next.js dev frontend on localhost:3000
  // -------------------------------------------------------------------------
  await app.register(cors, {
    origin: process.env.NODE_ENV === "production"
      ? false           // tighten this up when you have a real domain
      : "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // -------------------------------------------------------------------------
  // Prisma — decorated onto the app instance so route handlers can access it
  // via fastify.prisma or request.server.prisma
  // -------------------------------------------------------------------------
  const prisma = new PrismaClient();

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // Public routes
  // -------------------------------------------------------------------------

  app.get("/health", async (_request, _reply) => {
    return { status: "ok" };
  });

  // -------------------------------------------------------------------------
  // Protected routes
  // -------------------------------------------------------------------------

  // GET /me — looks up and returns the full User record for the authenticated
  // caller. Returns 404 if /sync hasn't been called yet for this user.
  app.get("/me", { preHandler: verifyAuth }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { auth0Id: request.auth0Id },
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found — call POST /sync first" });
    }

    return user;
  });

  // POST /sync — idempotent user creation.
  // Called once from the frontend after a successful Auth0 login to ensure a
  // corresponding User row exists in Postgres.
  //
  // Body: { name: string, email: string }
  // Returns 200 + existing user, or 201 + newly created user.
  app.post("/sync", { preHandler: verifyAuth }, async (request, reply) => {
    // --- Validate request body ---
    const body = request.body as Record<string, unknown>;

    const { name, email } = body ?? {};

    if (typeof name !== "string" || name.trim() === "") {
      return reply.code(400).send({ error: "name is required and must be a non-empty string" });
    }

    if (typeof email !== "string" || email.trim() === "") {
      return reply.code(400).send({ error: "email is required and must be a non-empty string" });
    }

    // Basic RFC-5322-ish email check: must have one @ with chars on both sides
    // and a dot in the domain part.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return reply.code(400).send({ error: "email must be a valid email address" });
    }

    const auth0Id = request.auth0Id;

    // --- Lookup first, then create if missing ---
    // We intentionally avoid upsert here: upsert would silently overwrite name
    // and email on every login. We only want to write on first sync; subsequent
    // calls are a no-op that returns the existing record.
    const existing = await app.prisma.user.findUnique({
      where: { auth0Id },
    });

    if (existing) {
      return reply.code(200).send(existing);
    }

    const newUser = await app.prisma.user.create({
      data: {
        auth0Id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
      },
    });

    return reply.code(201).send(newUser);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Start the server when this file is run directly
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "4000", 10);

buildApp()
  .then((app) => app.listen({ port: PORT, host: "0.0.0.0" }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
