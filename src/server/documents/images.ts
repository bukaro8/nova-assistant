const CLOUDINARY_HOST = "res.cloudinary.com";
const THUMBNAIL_TRANSFORMATION = "c_fill,w_640,h_360,q_auto,f_auto";

function isCloudinaryImageUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === CLOUDINARY_HOST;
  } catch {
    return false;
  }
}

export function getCloudinaryImageUrl(publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const cleanPublicId = publicId.trim();

  if (!cloudName || !cleanPublicId) {
    return null;
  }

  const encodedPublicId = cleanPublicId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://${CLOUDINARY_HOST}/${encodeURIComponent(
    cloudName,
  )}/image/upload/${THUMBNAIL_TRANSFORMATION}/${encodedPublicId}`;
}

export function getImportantDocumentImageSrc(document: {
  provider: string;
  storageKey: string;
  thumbnailUrl: string | null;
}) {
  if (document.thumbnailUrl && isCloudinaryImageUrl(document.thumbnailUrl)) {
    return document.thumbnailUrl;
  }

  if (document.provider === "cloudinary") {
    return getCloudinaryImageUrl(document.storageKey);
  }

  return null;
}
