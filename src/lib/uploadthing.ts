import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";
 
import type { OurFileRouter } from "@/app/api/uploadthing/core";
 
// Client-side components
export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// Helper function for client-side data URL conversion
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

// Generate React utilities using the FileRouter
const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

/**
 * Uploads a file to UploadThing's imageUploader endpoint
 * @param file - The file to upload
 * @returns A Promise that resolves to the uploaded file URL
 */
export async function uploadToUploadThing(file: File): Promise<string> {
  try {
    const res = await uploadFiles("imageUploader", { files: [file] });
    if (res[0]?.url) {
      return res[0].url;
    }
    throw new Error("Failed to get URL from uploaded file");
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

/**
 * Uploads a file to UploadThing's residualUploader endpoint
 * @param file - The file to upload
 * @returns A Promise that resolves to the uploaded file URL
 */
export async function uploadToUploadThingResidual(file: File): Promise<string> {
  try {
    const res = await uploadFiles("residualUploader", { files: [file] });
    if (res[0]?.url) {
      return res[0].url;
    }
    throw new Error("Failed to get URL from uploaded file");
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}


