CREATE TYPE "ImportantDocumentType" AS ENUM (
  'PASSPORT',
  'DRIVING_LICENCE',
  'INSURANCE',
  'VEHICLE',
  'MEDICAL',
  'PET',
  'OTHER'
);

CREATE TABLE "ImportantDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ImportantDocumentType" NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportantDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportantDocument_userId_idx" ON "ImportantDocument"("userId");
CREATE INDEX "ImportantDocument_userId_type_idx" ON "ImportantDocument"("userId", "type");
CREATE INDEX "ImportantDocument_userId_expiryDate_idx" ON "ImportantDocument"("userId", "expiryDate");

ALTER TABLE "ImportantDocument"
ADD CONSTRAINT "ImportantDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
