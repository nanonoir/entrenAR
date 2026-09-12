-- Add the discriminator with a safe CUSTOMER default so existing refresh rows
-- are classified before the final non-null constraint is enforced.
CREATE TYPE "RefreshSessionType" AS ENUM ('CUSTOMER', 'ADMIN');

ALTER TABLE "RefreshToken"
  ADD COLUMN "sessionType" "RefreshSessionType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "successorTokenHash" TEXT,
  ADD COLUMN "successorIssuedAt" TIMESTAMP(3);

ALTER TABLE "RefreshToken" ALTER COLUMN "sessionType" DROP DEFAULT;

CREATE INDEX "RefreshToken_userId_sessionType_idx"
  ON "RefreshToken"("userId", "sessionType");
