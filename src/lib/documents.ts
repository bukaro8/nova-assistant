import { ImportantDocumentType } from "@/generated/prisma/enums";

export const importantDocumentTypes = Object.values(ImportantDocumentType);

export function formatImportantDocumentType(type: string) {
  return type
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function isImportantDocumentType(
  value: string,
): value is ImportantDocumentType {
  return importantDocumentTypes.includes(value as ImportantDocumentType);
}
