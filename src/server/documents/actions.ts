"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

function dashboardRedirectMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/dashboard?${params.toString()}`);
}

export async function deleteImportantDocument(documentId: string) {
  const user = await requireCurrentUser();
  const result = await prisma.importantDocument.deleteMany({
    where: {
      id: documentId,
      userId: user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/documents/${documentId}`);

  if (result.count === 0) {
    dashboardRedirectMessage("error", "Document not found");
  }

  dashboardRedirectMessage("success", "Document deleted");
}
