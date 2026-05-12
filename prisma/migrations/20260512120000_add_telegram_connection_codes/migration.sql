CREATE TABLE "TelegramConnectionCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramConnectionCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramConnectionCode_codeHash_key" ON "TelegramConnectionCode"("codeHash");
CREATE INDEX "TelegramConnectionCode_userId_idx" ON "TelegramConnectionCode"("userId");
CREATE INDEX "TelegramConnectionCode_expiresAt_idx" ON "TelegramConnectionCode"("expiresAt");

ALTER TABLE "TelegramConnectionCode" ADD CONSTRAINT "TelegramConnectionCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
