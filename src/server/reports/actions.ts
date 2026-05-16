"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/server/dashboard/user";
import { generateWeeklyAiReportForUser } from "@/server/reports/weekly-ai-report";

export async function regenerateCurrentWeeklyAiReport() {
  const user = await requireCurrentUser();
  const result = await generateWeeklyAiReportForUser({
    userId: user.id,
    force: true,
    manual: true,
  });

  revalidatePath("/reports/weekly");

  if (result.status === "stored") {
    redirect("/reports/weekly?type=success&message=Weekly%20AI%20report%20regenerated.");
  }

  if ("message" in result) {
    redirect(`/reports/weekly?type=error&message=${encodeURIComponent(result.message)}`);
  }

  redirect("/reports/weekly");
}
