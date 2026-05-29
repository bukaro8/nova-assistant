"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isImportantDocumentType } from "@/lib/documents";
import { ImportantDocumentType } from "@/generated/prisma/enums";
import { getUtcForUkDateInput } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { prisma } from "@/server/db/prisma";

function redirectTo(pathname: string, type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`${pathname}?${params.toString()}`);
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
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);

  if (result.count === 0) {
    redirectTo("/dashboard", "error", "Document not found");
  }

  redirectTo("/documents", "success", "Document deleted");
}

export async function updateImportantDocument(
  documentId: string,
  formData: FormData,
) {
  const user = await requireCurrentUser();

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const rawExpiryDate = String(formData.get("expiryDate") ?? "").trim();
  const rawNotes = String(formData.get("notes") ?? "").trim();
  const notes = rawNotes || null;

  if (
    !title ||
    title.length > 120 ||
    !isImportantDocumentType(type)
  ) {
    redirectTo(`/documents/${documentId}/edit`, "error", "Invalid form data");
  }

  const updateData: {
    title: string;
    type: ImportantDocumentType;
    notes: string | null;
    expiryDate?: Date | null;
  } = {
    title,
    type: type as ImportantDocumentType,
    notes,
  };

  if (rawExpiryDate) {
    const expiryDate = getUtcForUkDateInput(rawExpiryDate);

    if (!expiryDate) {
      redirectTo(`/documents/${documentId}/edit`, "error", "Invalid expiry date");
    }

    updateData.expiryDate = expiryDate;
  } else {
    updateData.expiryDate = null;
  }

  const result = await prisma.importantDocument.updateMany({
    where: {
      id: documentId,
      userId: user.id,
    },
    data: updateData,
  });

  if (result.count === 0) {
    redirectTo(`/documents/${documentId}/edit`, "error", "Document not found");
  }

  revalidatePath("/dashboard");
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);

  redirectTo(`/documents/${documentId}`, "success", "Document updated");
}
