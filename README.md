# BuddyChecks

A pair-based accountability app for mental health habits. Two people commit to a shared or individual daily habit, check in once a day, and can send each other lightweight encouragement.

**Design philosophy:** gentle, non-punitive — no shaming for missed days, no competitive gamification, no group leaderboards.

## Stack

- **Backend:** Node.js + Fastify + Prisma ORM + PostgreSQL
- **Auth:** Auth0 (JWT)
- **Frontend:** Next.js (separate)

## Getting started (backend)

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL
docker compose up -d   # starts local Postgres 16
npx prisma migrate dev
```
