import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

export const ourFileRouter = {
  // General file uploader - supports PDFs, images, spreadsheets
  fileUploader: f({
    pdf: { maxFileSize: "64MB", maxFileCount: 10 },
    image: { maxFileSize: "32MB", maxFileCount: 10 },
    blob: { maxFileSize: "64MB", maxFileCount: 10 }, // For Excel files
  })
    .middleware(async () => {
      const { userId } = await auth();

      if (!userId) {
        throw new Error("Unauthorized");
      }

      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
