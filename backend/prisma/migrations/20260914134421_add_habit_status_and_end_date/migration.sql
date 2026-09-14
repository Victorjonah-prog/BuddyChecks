-- CreateEnum
CREATE TYPE "HabitStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "status" "HabitStatus" NOT NULL DEFAULT 'ACTIVE';
