import { FastifyInstance } from "fastify";
import { verifyAuth } from "../plugins/auth";

export async function pairRoutes(app: FastifyInstance) {

  // GET /pairs/me — protected
  // Returns the authenticated user's active pair(s) with basic partner info.
  app.get("/pairs/me", { preHandler: verifyAuth }, async (request, reply) => {
    const caller = await app.prisma.user.findUnique({
      where: { auth0Id: request.auth0Id },
    });

    if (!caller) {
      // Brand-new user: no record yet (sync runs client-side after first render).
      // This is a normal state — return an empty list, not an error.
      return reply.code(200).send([]);
    }

    const pairs = await app.prisma.pair.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ userAId: caller.id }, { userBId: caller.id }],
      },
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Shape the response so the caller always sees "partner" rather than
    // having to figure out whether they are userA or userB.
    const shaped = pairs.map((pair) => {
      const partner = pair.userAId === caller.id ? pair.userB : pair.userA;
      return {
        id: pair.id,
        status: pair.status,
        createdAt: pair.createdAt,
        partner: {
          id: partner.id,
          name: partner.name,
        },
      };
    });

    return shaped;
  });
}
