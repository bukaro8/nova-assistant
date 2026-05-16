CREATE TABLE "WeeklyAiReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "reportText" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regeneratedAt" TIMESTAMP(3),

    CONSTRAINT "WeeklyAiReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyAiReport_userId_idx" ON "WeeklyAiReport"("userId");

CREATE UNIQUE INDEX "WeeklyAiReport_userId_weekStart_key" ON "WeeklyAiReport"("userId", "weekStart");

ALTER TABLE "WeeklyAiReport" ADD CONSTRAINT "WeeklyAiReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
