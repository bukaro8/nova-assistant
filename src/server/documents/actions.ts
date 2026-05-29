"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ImportantDocumentType } from "@/generated/prisma/enums";
import { isImportantDocumentType } from "@/lib/documents";
import { getUtcForUkDateInput } from "@/server/dashboard/date-utils";
import { requireCurrentUser } from "@/server/dashboard/user";
import { getCloudinaryImageUrl } from "@/server/documents/images";
import { prisma } from "@/server/db/prisma";

const MAX_DOCUMENT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type ParsedDocumentForm = {
  title: string;
  type: ImportantDocumentType;
  expiryDate: Date | null;
  notes: string | null;
  image: File;
};

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
};

function documentsRedirectMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/documents/new?${params.toString()}`);
}

function dashboardRedirectMessage(
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message });
  redirect(`/dashboard?${params.toString()}`);
}

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return undefined;
  }

  return getUtcForUkDateInput(value);
}

function parseImportantDocumentForm(
  formData: FormData,
): ParsedDocumentForm | null {
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const rawExpiryDate = String(formData.get("expiryDate") ?? "").trim();
  const rawNotes = String(formData.get("notes") ?? "").trim();
  const image = formData.get("image");
  const expiryDate = parseDateInput(rawExpiryDate);
  const notes = rawNotes || null;

  if (
    !title ||
    title.length > 120 ||
    !isImportantDocumentType(type) ||
    expiryDate === undefined ||
    (notes && notes.length > 1000) ||
    !(image instanceof File) ||
    image.size <= 0 ||
    image.size > MAX_DOCUMENT_IMAGE_SIZE ||
    !ALLOWED_DOCUMENT_IMAGE_TYPES.has(image.type)
  ) {
    return null;
  }

  return {
    title,
    type,
    expiryDate,
    notes,
    image,
  };
}

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    apiKey,
    apiSecret,
    cloudName,
  };
}

async function signCloudinaryUpload({
  apiSecret,
  folder,
  timestamp,
}: {
  apiSecret: string;
  folder: string;
  timestamp: number;
}) {
  const payload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(payload),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCloudinaryThumbnailUrl(publicId: string, secureUrl: string) {
  const thumbnailUrl = getCloudinaryImageUrl(publicId);

  if (thumbnailUrl) {
    return thumbnailUrl;
  }

  return secureUrl.replace(
    "/upload/",
    "/upload/c_fill,w_640,h_360,q_auto,f_auto/",
  );
}

async function uploadDocumentImageToCloudinary({
  file,
  userId,
}: {
  file: File;
  userId: string;
}) {
  const config = getCloudinaryConfig();

  if (!config) {
    documentsRedirectMessage("error", "Document upload is not configured");
  }

  const folder = `nova/important-documents/${userId}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signCloudinaryUpload({
    apiSecret: config.apiSecret,
    folder,
    timestamp,
  });
  const body = new FormData();

  body.set("file", file);
  body.set("api_key", config.apiKey);
  body.set("folder", folder);
  body.set("timestamp", String(timestamp));
  body.set("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      body,
      method: "POST",
    },
  );

  if (!response.ok) {
    documentsRedirectMessage("error", "Document upload failed");
  }

  const result = (await response.json()) as Partial<CloudinaryUploadResult>;

  if (!result.public_id || !result.secure_url) {
    documentsRedirectMessage("error", "Document upload failed");
  }

  const thumbnailUrl = getCloudinaryThumbnailUrl(
    result.public_id,
    result.secure_url,
  );

  return {
    publicId: result.public_id,
    thumbnailUrl,
  };
}

async function isValidImageFile(file: File) {
  const buffer = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (
    file.type === "image/jpeg" &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }

  if (
    file.type === "image/png" &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  if (
    file.type === "image/gif" &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return true;
  }

  return (
    file.type === "image/webp" &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

export async function createImportantDocument(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = parseImportantDocumentForm(formData);

  if (!parsed) {
    documentsRedirectMessage("error", "Invalid document");
  }

  if (!(await isValidImageFile(parsed.image))) {
    documentsRedirectMessage("error", "Invalid image");
  }

  const upload = await uploadDocumentImageToCloudinary({
    file: parsed.image,
    userId: user.id,
  });

  await prisma.importantDocument.create({
    data: {
      userId: user.id,
      title: parsed.title,
      type: parsed.type,
      expiryDate: parsed.expiryDate,
      notes: parsed.notes,
      provider: "cloudinary",
      storageKey: upload.publicId,
      thumbnailUrl: upload.thumbnailUrl,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/documents/new");
  redirect("/dashboard?type=success&message=Document saved");
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
