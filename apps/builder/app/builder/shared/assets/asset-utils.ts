import type { Asset, FontAsset, ImageAsset } from "@webstudio-is/sdk";
import { nanoid } from "nanoid";
import type { UploadingFileData } from "~/shared/nano-states";

const imageExtensionToMime = new Map([
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
] as const);

const imageExtensions = [...imageExtensionToMime.keys()];

export const imageMimeTypes = [...imageExtensionToMime.values()];

export type ImageMimeType = (typeof imageMimeTypes)[number];
export type ImageExtension = (typeof imageExtensions)[number];

export function getImageExtensionForMimeType(
  mimeType: ImageMimeType
): ImageExtension;

export function getImageExtensionForMimeType(
  mimeType: string
): ImageExtension | undefined;

export function getImageExtensionForMimeType(mimeType: string) {
  const index = imageMimeTypes.indexOf(mimeType as any);
  return index > -1 ? imageExtensions[index] : undefined;
}

export function getImageNameAndType(
  url: string | URL,
  defaultExtension: (typeof imageExtensions)[number]
): [fileName: string, mimeType: string];

export function getImageNameAndType(
  url: string | URL,
  defaultExtension?: (typeof imageExtensions)[number]
): [fileName: string | undefined, mimeType: string | undefined];

export function getImageNameAndType(
  url: string | URL,
  defaultExtension?: (typeof imageExtensions)[number]
): [fileName: string | undefined, mimeType: string | undefined] {
  let extension: (typeof imageExtensions)[number] | undefined;

  if (typeof url === "string") {
    extension =
      imageExtensions.find((ext) => url.endsWith(ext)) ?? defaultExtension;

    return extension
      ? [url, imageExtensionToMime.get(extension)]
      : [undefined, undefined];
  }

  const basename = url.pathname.split("/").at(-1) ?? "";
  const contentDispositionKey = /\bcontent-disposition\b/i;
  const contentTypeKey = /\bcontent-type\b/i;

  let fileName: string | undefined;
  let mimeType: string | undefined;
  extension = imageExtensions.find((ext) => {
    let foundInSearchParams = false;

    // Check every search param in case a filename and/or mime type is specified.
    for (const key of url.searchParams.keys()) {
      const value = url.searchParams.get(key)!;
      if (!fileName && contentDispositionKey.test(key)) {
        const fileNameMatch = value.match(/\bfilename=(?:"([^"]+)"|([^;]+))/i);
        if (fileNameMatch) {
          fileName = fileNameMatch[1] ?? fileNameMatch[2] ?? "";
        }
      } else if (!mimeType && contentTypeKey.test(key)) {
        const mimeTypeMatch = value.match(/\b(image\/[\w-+]+)/i);
        if (mimeTypeMatch) {
          mimeType = mimeTypeMatch[1];
        }
      } else if (!foundInSearchParams && value.endsWith(ext)) {
        foundInSearchParams = true;
      }
    }

    if (basename.endsWith(ext)) {
      if (!fileName?.endsWith(ext)) {
        fileName = basename;
      }
      return true;
    }

    return Boolean(
      foundInSearchParams ||
        fileName?.endsWith(ext) ||
        mimeType === imageExtensionToMime.get(ext)
    );
  });

  extension ??= defaultExtension;

  // Trust the extension over the mime type.
  const impliedMimeType = extension && imageExtensionToMime.get(extension);
  if (impliedMimeType) {
    mimeType = impliedMimeType;
  }

  return mimeType
    ? [fileName ?? `${nanoid()}.${extension}`, mimeType]
    : [undefined, undefined];
}

export const getImageName = (file: File | URL) => {
  if (file instanceof File) {
    return file.name;
  }

  return getImageNameAndType(file)[0];
};

export const getImageType = (file: File | URL | string) => {
  if (file instanceof File) {
    return file.type;
  }

  return getImageNameAndType(file)[1];
};

const bufferToHex = (buffer: ArrayBuffer) => {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

export const getSha256Hash = async (data: string) => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  return bufferToHex(hashBuffer);
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

export const getSha256HashOfFile = async (file: File) => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return bufferToHex(hashBuffer);
};

export const uploadingFileDataToAsset = (
  fileData: UploadingFileData
): Asset => {
  const mimeType =
    getImageType(
      fileData.source === "file" ? fileData.file : new URL(fileData.url)
    ) ?? "image/png";
  const format = mimeType.split("/")[1];

  if (mimeType.startsWith("image/")) {
    const asset: ImageAsset = {
      id: fileData.assetId,
      name: fileData.objectURL,
      format,
      type: "image",
      description: "",
      createdAt: "",
      projectId: "",
      size: 0,

      meta: {
        width: Number.NaN,
        height: Number.NaN,
      },
    };

    return asset;
  }

  const asset: FontAsset = {
    id: fileData.assetId,
    name: fileData.objectURL,
    format: "woff2",
    type: "font",
    description: "",
    createdAt: "",
    projectId: "",
    size: 0,
    meta: {
      family: "system",
      style: "normal",
      weight: 400,
    },
  };

  return asset;
};
