"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadThing } from "~/lib/uploadthing-hooks";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { cn } from "~/lib/utils";
import { formatFileSize } from "~/lib/utils";
import { UploadIcon, CheckIcon, CloseIcon } from "./icons";

interface FileUploaderProps {
  onClose?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "saving" | "done" | "error";
  error?: string;
}

export function FileUploader({ onClose }: FileUploaderProps) {
  const { user } = useUser();
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const createFile = useMutation(api.files.createFile);

  const { startUpload, isUploading } = useUploadThing("fileUploader", {
    onUploadProgress: (progress) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading" ? { ...f, progress } : f
        )
      );
    },
    onClientUploadComplete: async (results) => {
      if (!user || !results) return;

      // Save each file to Convex
      for (const result of results) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file.name === result.name ? { ...f, status: "saving" } : f
          )
        );

        try {
          await createFile({
            name: result.name,
            url: result.url,
            fileKey: result.key,
            type: result.type,
            size: result.size,
            clerkId: user.id,
          });

          setFiles((prev) =>
            prev.map((f) =>
              f.file.name === result.name ? { ...f, status: "done" } : f
            )
          );
        } catch {
          setFiles((prev) =>
            prev.map((f) =>
              f.file.name === result.name
                ? { ...f, status: "error", error: "Failed to save file" }
                : f
            )
          );
        }
      }
    },
    onUploadError: (error) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error", error: error.message }
            : f
        )
      );
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Add files to state
      setFiles((prev) => [
        ...prev,
        ...acceptedFiles.map((file) => ({
          file,
          progress: 0,
          status: "uploading" as const,
        })),
      ]);

      // Start upload
      await startUpload(acceptedFiles);
    },
    [startUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxSize: 64 * 1024 * 1024, // 64MB
    disabled: isUploading,
  });

  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  return (
    <div className="p-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
          isUploading && "cursor-not-allowed opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-3 text-base font-medium text-gray-700">
          {isDragActive ? "Drop files here" : "Drag and drop files here"}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          or tap to select files
        </p>
        <p className="mt-3 text-xs text-gray-400">
          PDF, images, and Excel files up to 64MB
        </p>
      </div>

      {/* Upload progress */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {f.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(f.file.size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {f.status === "uploading" && (
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
                {f.status === "saving" && (
                  <span className="text-xs text-gray-500">Saving...</span>
                )}
                {f.status === "done" && (
                  <CheckIcon className="h-5 w-5 text-green-600" />
                )}
                {f.status === "error" && (
                  <span className="text-xs text-red-600">{f.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done button */}
      {allDone && onClose && (
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Done
        </button>
      )}
    </div>
  );
}
