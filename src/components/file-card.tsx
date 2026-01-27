"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  cn,
  formatFileSize,
  formatDate,
  getFileIcon,
  shareFile,
} from "~/lib/utils";
import {
  FileIcon,
  ImageIcon,
  PdfIcon,
  SpreadsheetIcon,
  ShareIcon,
  TrashIcon,
  DownloadIcon,
  MoreIcon,
} from "./icons";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

interface FileCardProps {
  id: Id<"files">;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: number;
  sharedWithFamily: boolean;
  isOwner: boolean;
  uploaderName?: string;
}

export function FileCard({
  id,
  name,
  url,
  type,
  size,
  createdAt,
  sharedWithFamily,
  isOwner,
  uploaderName,
}: FileCardProps) {
  const { user } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">(
    "idle"
  );
  const [imageError, setImageError] = useState(false);

  const deleteFile = useMutation(api.files.deleteFile);
  const toggleShare = useMutation(api.files.toggleShareFile);

  const fileIcon = getFileIcon(type);
  const isImage = type.startsWith("image/");

  const handleShare = async () => {
    const canShare = typeof navigator !== "undefined" && "share" in navigator;
    const shared = await shareFile(name, url);
    if (shared) {
      setShareStatus(canShare ? "shared" : "copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    }
    setShowMenu(false);
  };

  const handleToggleShareWithFamily = async () => {
    if (!user) return;
    await toggleShare({ fileId: id, clerkId: user.id });
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteFile({ fileId: id, clerkId: user.id });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDownload = () => {
    window.open(url, "_blank");
    setShowMenu(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open file if clicking menu button or dropdown
    if ((e.target as HTMLElement).closest("button")) return;
    window.open(url, "_blank");
  };

  const IconComponent = {
    image: ImageIcon,
    pdf: PdfIcon,
    spreadsheet: SpreadsheetIcon,
    file: FileIcon,
  }[fileIcon];

  const iconColors = {
    image: "text-purple-600 bg-purple-50",
    pdf: "text-red-600 bg-red-50",
    spreadsheet: "text-green-600 bg-green-50",
    file: "text-blue-600 bg-blue-50",
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md active:bg-gray-50"
      >
        {/* Image preview or icon */}
        {isImage && !imageError ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
            <Image
              src={url}
              alt={name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="p-4 pb-0">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                iconColors[fileIcon]
              )}
            >
              <IconComponent className="h-6 w-6" />
            </div>
          </div>
        )}

        {/* File info */}
        <div className="p-4">
          <h3 className="mb-1 truncate font-medium text-gray-900" title={name}>
            {name}
          </h3>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{formatFileSize(size)}</span>
            <span className="text-gray-300">|</span>
            <span>{formatDate(createdAt)}</span>
          </div>

          {/* Shared indicator or uploader name */}
          {sharedWithFamily && isOwner && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              <ShareIcon className="h-3 w-3" />
              Shared with family
            </div>
          )}
          {uploaderName && !isOwner && (
            <p className="mt-2 text-xs text-gray-400">From {uploaderName}</p>
          )}
        </div>

        {/* Actions menu button - always visible on mobile */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={cn(
            "absolute right-3 top-3 rounded-lg bg-white/90 p-1.5 text-gray-500 shadow-sm backdrop-blur-sm",
            "hover:bg-white hover:text-gray-700",
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
            "transition-opacity",
            showMenu && "opacity-100"
          )}
          aria-label="More options"
        >
          <MoreIcon className="h-5 w-5" />
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div
              className="absolute right-3 top-12 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleDownload}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              >
                <DownloadIcon className="h-4 w-4" />
                Open file
              </button>
              <button
                onClick={handleShare}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              >
                <ShareIcon className="h-4 w-4" />
                {shareStatus === "shared"
                  ? "Shared!"
                  : shareStatus === "copied"
                    ? "Link copied!"
                    : "Share link"}
              </button>
              {isOwner && (
                <>
                  <button
                    onClick={handleToggleShareWithFamily}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <ShareIcon className="h-4 w-4" />
                    {sharedWithFamily ? "Unshare with family" : "Share with family"}
                  </button>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete file?"
      >
        <p className="mb-6 text-gray-600">
          Are you sure you want to delete &ldquo;{name}&rdquo;? This cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={isDeleting}
            className="flex-1"
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
