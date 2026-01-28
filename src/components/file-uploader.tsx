"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { useUploadThing } from "~/lib/uploadthing-hooks";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "~/lib/utils";
import { formatFileSize } from "~/lib/utils";
import { UploadIcon, CheckIcon, CloseIcon } from "./icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "./ui/toast";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  email: string;
  role?: "owner" | "member";
}

interface FolderOption {
  _id: Id<"folders">;
  name: string;
  parentFolderId?: Id<"folders">;
  assignedTo?: Id<"users">;
}

interface FileUploaderProps {
  onClose?: () => void;
  familyMembers: FamilyMember[];
  currentFolderId?: Id<"folders">;
  currentFolderAssignee?: Id<"users">;
  folders?: FolderOption[];
}

interface PendingFile {
  file: File;
  customName: string;
  originalName: string;
  assignedTo?: Id<"users">;
  folderId?: Id<"folders">;
  tags: string[];
}

interface UploadingFile {
  customName: string;
  originalName: string;
  size: number;
  progress: number;
  status: "compressing" | "uploading" | "saving" | "done" | "error";
  error?: string;
}

// Metadata stored in ref to avoid closure issues
interface UploadMetadata {
  originalName: string;
  assignedTo?: Id<"users">;
  folderId?: Id<"folders">;
  tags: string[];
}

// Convert custom name to filename format (e.g., "National Insurance" -> "National-Insurance")
function formatFileName(customName: string, extension: string): string {
  return (
    customName
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "") + extension
  );
}

// Get file extension
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.slice(lastDot) : "";
}

// Compress image to under 1MB
async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.95, // Slightly under 1MB to be safe
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch {
    // If compression fails, return original
    return file;
  }
}

export function FileUploader({
  onClose,
  familyMembers,
  currentFolderId,
  currentFolderAssignee,
  folders = [],
}: FileUploaderProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tagInput, setTagInput] = useState<Record<number, string>>({});
  const createFile = useMutation(api.files.createFile);

  // Use ref to store metadata to avoid closure issues in callbacks
  const uploadMetadataRef = useRef<Map<string, UploadMetadata>>(new Map());

  // All family members (including owner) can be assigned files
  const assignableMembers = familyMembers;

  // Auto-close and show toast when all uploads complete
  const allDone = uploadingFiles.length > 0 && uploadingFiles.every((f) => f.status === "done");
  const hasErrors = uploadingFiles.some((f) => f.status === "error");

  useEffect(() => {
    if (allDone && !hasErrors) {
      const count = uploadingFiles.length;
      toast(`${count} file${count > 1 ? "s" : ""} uploaded successfully`);
      onClose?.();
    }
  }, [allDone, hasErrors, uploadingFiles.length, toast, onClose]);

  const { startUpload, isUploading } = useUploadThing("fileUploader", {
    onUploadProgress: (progress) => {
      setUploadingFiles((prev) =>
        prev.map((f) => (f.status === "uploading" ? { ...f, progress } : f))
      );
    },
    onClientUploadComplete: async (results) => {
      if (!user || !results) return;

      // Save each file to Convex
      for (const result of results) {
        // Get metadata from ref (not from state to avoid closure issues)
        const metadata = uploadMetadataRef.current.get(result.name);

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.customName === result.name ? { ...f, status: "saving" } : f
          )
        );

        try {
          await createFile({
            name: result.name,
            originalName: metadata?.originalName ?? result.name,
            url: result.url,
            fileKey: result.key,
            type: result.type,
            size: result.size,
            clerkId: user.id,
            assignedTo: metadata?.assignedTo,
            folderId: metadata?.folderId,
            tags: metadata?.tags ?? [],
          });

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.customName === result.name ? { ...f, status: "done" } : f
            )
          );
        } catch {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.customName === result.name
                ? { ...f, status: "error", error: "Failed to save file" }
                : f
            )
          );
        }
      }

      // Clear metadata ref after upload completes
      uploadMetadataRef.current.clear();
    },
    onUploadError: (error) => {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading" || f.status === "compressing"
            ? { ...f, status: "error", error: error.message }
            : f
        )
      );
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Add files to pending with default names
      // Default assignee to the folder's assignee if uploading into an assigned folder
      const newPendingFiles = acceptedFiles.map((file) => ({
        file,
        customName: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for display
        originalName: file.name,
        assignedTo: currentFolderAssignee,
        folderId: currentFolderId,
        tags: [],
      }));

      setPendingFiles((prev) => [...prev, ...newPendingFiles]);
    },
    [currentFolderId, currentFolderAssignee]
  );

  const updateFileName = (index: number, newName: string) => {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, customName: newName } : f))
    );
  };

  // Get folders filtered by assignee
  const getFoldersForAssignee = (assignedTo?: Id<"users">) => {
    return folders.filter((folder) => {
      // If no assignee selected (family/unassigned), show unassigned folders
      if (!assignedTo) {
        return !folder.assignedTo;
      }
      // Otherwise show folders assigned to that person
      return folder.assignedTo === assignedTo;
    });
  };

  const updateAssignee = (index: number, assignedTo?: Id<"users">) => {
    setPendingFiles((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        // Reset folder if it doesn't belong to the new assignee
        const validFolders = getFoldersForAssignee(assignedTo);
        const folderStillValid = f.folderId && validFolders.some((folder) => folder._id === f.folderId);
        return {
          ...f,
          assignedTo,
          folderId: folderStillValid ? f.folderId : undefined,
        };
      })
    );
  };

  const updateFolder = (index: number, folderId?: Id<"folders">) => {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, folderId } : f))
    );
  };

  const addTag = (index: number, tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (!trimmedTag) return;

    setPendingFiles((prev) =>
      prev.map((f, i) =>
        i === index && !f.tags.includes(trimmedTag)
          ? { ...f, tags: [...f.tags, trimmedTag] }
          : f
      )
    );
    setTagInput((prev) => ({ ...prev, [index]: "" }));
  };

  const removeTag = (index: number, tag: string) => {
    setPendingFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f
      )
    );
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);

    // Clear previous metadata
    uploadMetadataRef.current.clear();

    // Process and compress files
    const processedFiles: UploadingFile[] = [];
    const filesToUpload: File[] = [];

    for (const pending of pendingFiles) {
      const extension = getExtension(pending.originalName);
      const formattedName = formatFileName(pending.customName, extension);

      // Store metadata in ref for later use in callback
      uploadMetadataRef.current.set(formattedName, {
        originalName: pending.originalName,
        assignedTo: pending.assignedTo,
        folderId: pending.folderId,
        tags: pending.tags,
      });

      // Add to uploading state as compressing
      const uploadingFile: UploadingFile = {
        customName: formattedName,
        originalName: pending.originalName,
        size: pending.file.size,
        progress: 0,
        status: "compressing",
      };
      processedFiles.push(uploadingFile);

      // Compress if it's an image and over 1MB
      let fileToUpload = pending.file;
      if (
        pending.file.type.startsWith("image/") &&
        pending.file.size > 1024 * 1024
      ) {
        try {
          fileToUpload = await compressImage(pending.file);
        } catch {
          // Use original if compression fails
        }
      }

      // Create a new file with the formatted name
      const renamedFile = new File([fileToUpload], formattedName, {
        type: fileToUpload.type,
      });

      filesToUpload.push(renamedFile);
    }

    setUploadingFiles(processedFiles);
    setPendingFiles([]);

    // Update all to uploading status
    setUploadingFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const }))
    );

    setIsProcessing(false);

    // Start upload
    void startUpload(filesToUpload);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
    },
    maxSize: 64 * 1024 * 1024, // 64MB (will be compressed if image)
    disabled: isUploading || isProcessing,
  });

  const hasUploading = uploadingFiles.some(
    (f) =>
      f.status === "uploading" ||
      f.status === "compressing" ||
      f.status === "saving"
  );

  return (
    <div className="space-y-4">
      {/* Dropzone - only show if no pending files */}
      {pendingFiles.length === 0 && uploadingFiles.length === 0 && (
        <div
          {...getRootProps()}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            isDragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50",
            (isUploading || isProcessing) && "cursor-not-allowed opacity-50"
          )}
        >
          <input {...getInputProps()} />
          <UploadIcon className="mx-auto h-10 w-10 text-zinc-500" />
          <p className="mt-3 text-base font-medium text-zinc-200">
            {isDragActive ? "Drop files here" : "Drag and drop files here"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">or tap to select files</p>
          <p className="mt-3 text-xs text-zinc-600">
            PDF, images, Word, and Excel files. Images over 1MB will be compressed.
          </p>
        </div>
      )}

      {/* Pending files - name entry */}
      {pendingFiles.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-300">
            Name your files and assign to family members
          </p>
          <div className="max-h-[400px] space-y-4 overflow-y-auto pr-1">
          {pendingFiles.map((pending, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {pending.originalName} ({formatFileSize(pending.file.size)})
                </span>
                <button
                  onClick={() => removePendingFile(index)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>

              {/* File name */}
              <Input
                placeholder="What is this file?"
                value={pending.customName}
                onChange={(e) => updateFileName(index, e.target.value)}
                autoFocus={index === 0}
              />
              <p className="mt-1.5 text-xs text-zinc-600">
                Will be saved as:{" "}
                {formatFileName(
                  pending.customName,
                  getExtension(pending.originalName)
                )}
              </p>

              {/* Assign to member - shown first */}
              {assignableMembers.length > 0 && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                    Assign to
                  </label>
                  <select
                    value={pending.assignedTo ?? ""}
                    onChange={(e) =>
                      updateAssignee(
                        index,
                        e.target.value
                          ? (e.target.value as Id<"users">)
                          : undefined
                      )
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="">Unassigned (family documents)</option>
                    {assignableMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name}
                        {member.role === "owner" ? " (Me)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Folder selection - filtered by assignee */}
              {(() => {
                const availableFolders = getFoldersForAssignee(pending.assignedTo);
                if (availableFolders.length === 0) return null;
                return (
                  <div className="mt-4">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                      Folder
                    </label>
                    <select
                      value={pending.folderId ?? ""}
                      onChange={(e) =>
                        updateFolder(
                          index,
                          e.target.value
                            ? (e.target.value as Id<"folders">)
                            : undefined
                        )
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      <option value="">Root (no folder)</option>
                      {availableFolders.map((folder) => (
                        <option key={folder._id} value={folder._id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              {/* Tags */}
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                  Tags (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {pending.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-medium text-violet-400"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(index, tag)}
                        className="hover:text-violet-200"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={tagInput[index] ?? ""}
                    onChange={(e) =>
                      setTagInput((prev) => ({ ...prev, [index]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(index, tagInput[index] ?? "");
                      }
                    }}
                    onBlur={() => addTag(index, tagInput[index] ?? "")}
                    className="min-w-[100px] flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  Press Enter or comma to add tags
                </p>
              </div>
            </div>
          ))}
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setPendingFiles([])}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                pendingFiles.some((f) => !f.customName.trim()) || isProcessing
              }
              loading={isProcessing}
              className="flex-1"
            >
              Upload {pendingFiles.length} file
              {pendingFiles.length > 1 ? "s" : ""}
            </Button>
          </div>

          {/* Add more files */}
          <div
            {...getRootProps()}
            className="cursor-pointer rounded-lg border border-dashed border-zinc-700 p-3 text-center text-sm text-zinc-500 hover:bg-zinc-800/50"
          >
            <input {...getInputProps()} />
            + Add more files
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {f.customName}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatFileSize(f.size)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {f.status === "compressing" && (
                  <span className="text-xs text-zinc-500">Compressing...</span>
                )}
                {f.status === "uploading" && (
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-700">
                    <div
                      className="h-full bg-violet-500 transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
                {f.status === "saving" && (
                  <span className="text-xs text-zinc-500">Saving...</span>
                )}
                {f.status === "done" && (
                  <CheckIcon className="h-5 w-5 text-green-500" />
                )}
                {f.status === "error" && (
                  <span className="text-xs text-red-400">{f.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploading indicator */}
      {hasUploading && (
        <p className="text-center text-sm text-zinc-500">
          Please wait while your files are being uploaded...
        </p>
      )}
    </div>
  );
}
