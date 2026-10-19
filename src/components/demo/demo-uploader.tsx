"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/ui/toast";
import { CheckIcon, CloseIcon, UploadIcon } from "~/components/icons";
import { cn, formatFileSize } from "~/lib/utils";
import { selectFolderPath, useDemo } from "./demo-store";

interface PendingFile {
  file: File;
  customName: string;
  assignedTo?: string;
  folderId?: string;
  tags: string[];
}

interface UploadingFile {
  name: string;
  size: number;
  progress: number;
}

// Same naming rule as the real uploader: "VAT Return Q3" -> "VAT-Return-Q3.pdf"
function formatFileName(customName: string, originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const ext = dot !== -1 ? originalName.slice(dot) : "";
  return (
    customName
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "") + ext
  );
}

function guessName(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  return (dot !== -1 ? originalName.slice(0, dot) : originalName).replace(
    /[-_]+/g,
    " ",
  );
}

export function DemoUploader({
  onClose,
  currentFolderId,
  currentFolderAssignee,
}: {
  onClose: () => void;
  currentFolderId?: string;
  currentFolderAssignee?: string;
}) {
  const { state, addFiles } = useDemo();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [tagInput, setTagInput] = useState<Record<number, string>>({});

  const onDrop = useCallback(
    (accepted: File[]) => {
      setPending((prev) => [
        ...prev,
        ...accepted.slice(0, 50 - prev.length).map((file) => ({
          file,
          customName: guessName(file.name),
          assignedTo: currentFolderAssignee,
          folderId: currentFolderId,
          tags: [],
        })),
      ]);
    },
    [currentFolderAssignee, currentFolderId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 64 * 1024 * 1024,
    maxFiles: 50,
  });

  const update = (index: number, patch: Partial<PendingFile>) =>
    setPending((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );

  const addTag = (index: number, raw: string) => {
    const tag = raw.trim().replace(/,$/, "").toLowerCase();
    setTagInput((prev) => ({ ...prev, [index]: "" }));
    if (!tag) return;
    setPending((prev) =>
      prev.map((p, i) =>
        i === index && !p.tags.includes(tag)
          ? { ...p, tags: [...p.tags, tag] }
          : p,
      ),
    );
  };

  const foldersFor = (assignedTo?: string) =>
    state.folders
      .filter((f) => f.assignedTo === assignedTo)
      .map((f) => ({
        id: f.id,
        label: selectFolderPath(state, f.id)
          .map((p) => p.name)
          .join(" / "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

  const startUpload = () => {
    const batch = pending;
    setPending([]);
    setUploading(
      batch.map((p) => ({
        name: formatFileName(p.customName, p.file.name),
        size: p.file.size,
        progress: 0,
      })),
    );

    // Simulated network progress - files never leave the browser
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      setUploading((prev) =>
        prev.map((u, i) => ({
          ...u,
          progress: Math.min(100, u.progress + 18 + ((i * 7 + tick * 3) % 15)),
        })),
      );
      if (tick >= 7) {
        clearInterval(timer);
        addFiles(
          batch.map((p) => ({
            name: formatFileName(p.customName, p.file.name),
            url: URL.createObjectURL(p.file),
            type: p.file.type || "application/octet-stream",
            size: p.file.size,
            assignedTo: p.assignedTo,
            folderId: p.folderId,
            tags: p.tags,
          })),
        );
        setUploading((prev) => prev.map((u) => ({ ...u, progress: 100 })));
        toast(
          `${batch.length} file${batch.length > 1 ? "s" : ""} uploaded successfully`,
        );
        setTimeout(onClose, 350);
      }
    }, 160);
  };

  if (uploading.length > 0) {
    return (
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {uploading.map((u, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {u.name}
              </p>
              <p className="text-xs text-zinc-500">{formatFileSize(u.size)}</p>
            </div>
            {u.progress >= 100 ? (
              <CheckIcon className="h-5 w-5 text-green-500" />
            ) : (
              <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
        <p className="pt-1 text-center text-sm text-zinc-500">
          Please wait while your files are being uploaded...
        </p>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="space-y-4">
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors",
            isDragActive
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50",
          )}
        >
          <input {...getInputProps()} />
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20 text-violet-400">
            <UploadIcon className="h-7 w-7" />
          </div>
          <p className="font-medium text-zinc-100">
            {isDragActive
              ? "Drop files here"
              : "Drag files here or tap to browse"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            PDFs, spreadsheets, photos of receipts - up to 64MB, 50 files at a
            time
          </p>
        </div>
        <p className="rounded-lg bg-zinc-800/50 p-3 text-xs text-zinc-500">
          Demo mode: files stay in your browser and disappear when you refresh.
          Nothing is uploaded anywhere.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        {pending.map((p, index) => {
          const folders = foldersFor(p.assignedTo);
          return (
            <div
              key={index}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="text-xs text-zinc-500">
                  {p.file.name} ({formatFileSize(p.file.size)})
                </span>
                <button
                  onClick={() =>
                    setPending((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <Input
                placeholder="What is this file?"
                value={p.customName}
                onChange={(e) => update(index, { customName: e.target.value })}
                autoFocus={index === 0}
              />
              <p className="mt-1.5 text-xs text-zinc-600">
                Will be saved as: {formatFileName(p.customName, p.file.name)}
              </p>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                  Assign to
                </label>
                <select
                  value={p.assignedTo ?? ""}
                  onChange={(e) =>
                    update(index, {
                      assignedTo: e.target.value || undefined,
                      folderId: undefined,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                >
                  <option value="">Unassigned (family documents)</option>
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.role === "owner" ? " (Me)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {folders.length > 0 && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                    Folder
                  </label>
                  <select
                    value={p.folderId ?? ""}
                    onChange={(e) =>
                      update(index, { folderId: e.target.value || undefined })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                  >
                    <option value="">Root (no folder)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                  Tags (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-medium text-violet-400"
                    >
                      {tag}
                      <button
                        onClick={() =>
                          update(index, {
                            tags: p.tags.filter((t) => t !== tag),
                          })
                        }
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
                      setTagInput((prev) => ({
                        ...prev,
                        [index]: e.target.value,
                      }))
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
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => setPending([])}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={startUpload}
          disabled={pending.some((p) => !p.customName.trim())}
          className="flex-1"
        >
          Upload {pending.length} file{pending.length > 1 ? "s" : ""}
        </Button>
      </div>
      <div
        {...getRootProps()}
        className="cursor-pointer rounded-lg border border-dashed border-zinc-700 p-3 text-center text-sm text-zinc-500 hover:bg-zinc-800/50"
      >
        <input {...getInputProps()} />+ Add more files
      </div>
    </div>
  );
}
