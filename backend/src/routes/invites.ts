import { FastifyInstance } from "fastify";
import { verifyAuth } from "../plugins/auth";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates an 8-character URL-safe random code (base64url, no padding). */
function generateCode(): string {
  // 6 random bytes → 8 base64url characters (6 * 8 bits / 6 bits per char)
  return randomBytes(6).toString("base64url");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function inviteRoutes(app: FastifyInstance) {

  // POST /invites — create a new invite
  // Protected. Blocked if the caller is already in an active pair.
  app.post("/invites", { preHandler: verifyAuth }, async (request, reply) => {
    const caller = await app.prisma.user.findUnique({
      where: { auth0Id: request.auth0Id },
    });

    if (!caller) {
      return reply.code(404).send({ error: "User not found — call POST /sync first" });
    }

    // Block if already in an active pair
    const activePair = await app.prisma.pair.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ userAId: caller.id }, { userBId: caller.id }],
      },
    });

    if (activePair) {
      return reply.code(400).send({
        error: "You're already paired with someone",
      });
    }

    // Generate a unique code — retry on the rare collision
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      const existing = await app.prisma.invite.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    if (attempts >= 5) {
      // Astronomically unlikely, but handle it gracefully
      return reply.code(500).send({ error: "Failed to generate a unique invite code — please try again" });
    }

    const invite = await app.prisma.invite.create({
      data: {
        code,
        createdById: caller.id,
        status: "PENDING",
      },
    });

    return reply.code(201).send(invite);
  });

  // GET /invites/:code — public, no auth required
  // Returns enough info to show "Jamie invited you to BuddyChecks"
  app.get<{ Params: { code: string } }>(
    "/invites/:code",
    async (request, reply) => {
      const { code } = request.params;

      const invite = await app.prisma.invite.findUnique({
        where: { code },
        include: {
          createdBy: {
            select: { name: true },
          },
        },
      });

      if (!invite) {
        return reply.code(404).send({ error: "Invite not found" });
      }

      if (invite.status === "ACCEPTED") {
        return reply.code(410).send({ error: "This invite has already been accepted" });
      }

      if (invite.status === "EXPIRED") {
        return reply.code(410).send({ error: "This invite has expired" });
      }

      return {
        code: invite.code,
        status: invite.status,
        inviterName: invite.createdBy.name,
        createdAt: invite.createdAt,
      };
    }
  );

  // POST /invites/:code/accept — protected
  // Validates the invite, creates the Pair, marks invite ACCEPTED.
  app.post<{ Params: { code: string } }>(
    "/invites/:code/accept",
    { preHandler: verifyAuth },
    async (request, reply) => {
      const { code } = request.params;

      const invite = await app.prisma.invite.findUnique({
        where: { code },
      });

      if (!invite) {
        return reply.code(404).send({ error: "Invite not found" });
      }

      if (invite.status === "ACCEPTED") {
        return reply.code(410).send({ error: "This invite has already been accepted" });
      }

      if (invite.status === "EXPIRED") {
        return reply.code(410).send({ error: "This invite has expired" });
      }

      const accepter = await app.prisma.user.findUnique({
        where: { auth0Id: request.auth0Id },
      });

      if (!accepter) {
        return reply.code(404).send({ error: "User not found — call POST /sync first" });
      }

      // Prevent self-acceptance
      if (invite.createdById === accepter.id) {
        return reply.code(400).send({ error: "You cannot accept your own invite" });
      }

      // Block if the accepter is already in an active pair
      const accepterActivePair = await app.prisma.pair.findFirst({
        where: {
          status: "ACTIVE",
          OR: [{ userAId: accepter.id }, { userBId: accepter.id }],
        },
      });

      if (accepterActivePair) {
        return reply.code(400).send({
          error: "You're already paired with someone",
        });
      }

      // Run both writes in a transaction so they succeed or fail together
      const pair = await app.prisma.$transaction(async (tx) => {
        const createdPair = await tx.pair.create({
          data: {
            userAId: invite.createdById,
            userBId: accepter.id,
            status: "ACTIVE",
          },
        });

        await tx.invite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED" },
        });

        return createdPair;
      });

      return reply.code(201).send(pair);
    }
  );
}
