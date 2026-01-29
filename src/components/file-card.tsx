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
  UserIcon,
  MoveIcon,
} from "./icons";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { ShareModal } from "./share-modal";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  email: string;
  imageUrl?: string;
  role?: "owner" | "member";
}

interface FileCardProps {
  id: Id<"files">;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: number;
  sharedWithFamily: boolean;
  sharedWith?: Id<"users">[];
  tags?: string[];
  assignedTo?: Id<"users">;
  assigneeName?: string;
  isOwner: boolean;
  uploaderName?: string;
  familyMembers?: FamilyMember[];
  folderId?: Id<"folders">;
  folderName?: string; // For showing location in search results
  onMoveClick?: () => void;
  // Selection props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: Id<"files">) => void;
}

export function FileCard({
  id,
  name,
  url,
  type,
  size,
  createdAt,
  sharedWithFamily,
  sharedWith = [],
  tags = [],
  assignedTo,
  assigneeName,
  isOwner,
  uploaderName,
  familyMembers = [],
  folderName,
  onMoveClick,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: FileCardProps) {
  const { user } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">(
    "idle"
  );
  const [imageError, setImageError] = useState(false);

  const deleteFile = useMutation(api.files.deleteFile);
  const updateAssignment = useMutation(api.files.updateFileAssignment);

  // All family members (including owner) can be assigned
  const assignableMembers = familyMembers;

  // Check if current user can share this file (owner OR file is assigned to them)
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress;
  const currentMember = familyMembers.find((m) => m.email === currentUserEmail);
  const isAssignedToMe = currentMember && assignedTo === currentMember._id;
  const canShare = isOwner || isAssignedToMe;

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

  const handleOpenShareModal = () => {
    setShowMenu(false);
    setShowShareModal(true);
  };

  const handleOpenReassignModal = () => {
    setShowMenu(false);
    setShowReassignModal(true);
  };

  const handleReassign = async (newAssignee?: Id<"users">) => {
    if (!user) return;
    setIsReassigning(true);
    try {
      await updateAssignment({
        fileId: id,
        clerkId: user.id,
        assignedTo: newAssignee,
      });
      setShowReassignModal(false);
    } finally {
      setIsReassigning(false);
    }
  };

  // Check if file is shared with specific members (not whole family)
  const isSharedWithSome = sharedWith.length > 0 && !sharedWithFamily;

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      // Delete from Convex DB and get the file key
      const result = await deleteFile({ fileId: id, clerkId: user.id });

      // Delete from UploadThing storage
      if (result?.fileKey) {
        await fetch("/api/uploadthing/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKey: result.fileKey }),
        });
      }
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
    // Don't open file if clicking menu button, dropdown, or checkbox
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest("input[type='checkbox']")) return;

    // In selection mode, toggle selection instead of opening file
    if (selectionMode && onToggleSelect) {
      onToggleSelect(id);
      return;
    }

    window.open(url, "_blank");
  };

  const IconComponent = {
    image: ImageIcon,
    pdf: PdfIcon,
    spreadsheet: SpreadsheetIcon,
    file: FileIcon,
  }[fileIcon];

  const iconColors = {
    image: "text-purple-400 bg-purple-500/20",
    pdf: "text-red-400 bg-red-500/20",
    spreadsheet: "text-green-400 bg-green-500/20",
    file: "text-violet-400 bg-violet-500/20",
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={cn(
          "group relative cursor-pointer rounded-xl border bg-zinc-900 transition-all",
          isSelected
            ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/50"
            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 active:bg-zinc-800"
        )}
      >
        {/* Selection checkbox */}
        {(selectionMode || isSelected) && isOwner && (
          <label
            className={cn(
              "absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-colors",
              isSelected
                ? "border-violet-500 bg-violet-500"
                : "border-zinc-600 bg-zinc-900/90 hover:border-zinc-500"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(id)}
              className="sr-only"
            />
            {isSelected && (
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </label>
        )}
        {/* Image preview or icon */}
        {isImage && !imageError ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-800">
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
          <h3 className="mb-1 truncate font-medium text-zinc-100" title={name}>
            {name}
          </h3>

          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>{formatFileSize(size)}</span>
            <span className="text-zinc-700">|</span>
            <span>{formatDate(createdAt)}</span>
          </div>

          {/* Folder location (shown in search results) */}
          {folderName && (
            <p className="mt-1 truncate text-xs text-zinc-500">
              in {folderName}
            </p>
          )}

          {/* Assignee */}
          {assigneeName && (
            <p className="mt-2 text-xs text-zinc-500">
              Assigned to {assigneeName}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Shared indicator or uploader name */}
          {sharedWithFamily && isOwner && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400">
              <ShareIcon className="h-3 w-3" />
              Shared with family
            </div>
          )}
          {isSharedWithSome && isOwner && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400">
              <ShareIcon className="h-3 w-3" />
              Shared with {sharedWith.length}{" "}
              {sharedWith.length === 1 ? "person" : "people"}
            </div>
          )}
          {uploaderName && !isOwner && (
            <p className="mt-2 text-xs text-zinc-500">From {uploaderName}</p>
          )}
        </div>

        {/* Actions menu button - always visible on mobile */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={cn(
            "absolute right-3 top-3 rounded-lg bg-zinc-900/90 p-1.5 text-zinc-400 shadow-sm backdrop-blur-sm",
            "hover:bg-zinc-800 hover:text-zinc-200",
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
              className="absolute right-3 top-12 z-20 w-48 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleDownload}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
              >
                <DownloadIcon className="h-4 w-4" />
                Open file
              </button>
              <button
                onClick={handleShare}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
              >
                <ShareIcon className="h-4 w-4" />
                {shareStatus === "shared"
                  ? "Shared!"
                  : shareStatus === "copied"
                    ? "Link copied!"
                    : "Share link"}
              </button>
              {canShare && (
                <button
                  onClick={handleOpenShareModal}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
                >
                  <ShareIcon className="h-4 w-4" />
                  {sharedWithFamily || isSharedWithSome
                    ? "Manage sharing"
                    : "Share with family"}
                </button>
              )}
              {isOwner && (
                <>
                  {onMoveClick && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onMoveClick();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
                    >
                      <MoveIcon className="h-4 w-4" />
                      Move to folder
                    </button>
                  )}
                  {assignableMembers.length > 0 && (
                    <button
                      onClick={handleOpenReassignModal}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
                    >
                      <UserIcon className="h-4 w-4" />
                      {assignedTo ? "Reassign" : "Assign to"}
                    </button>
                  )}
                  <hr className="my-1 border-zinc-700" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20"
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
        <p className="mb-6 text-zinc-400">
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

      {/* Share modal */}
      {canShare && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          fileId={id}
          fileName={name}
          sharedWithFamily={sharedWithFamily}
          sharedWith={sharedWith}
          familyMembers={familyMembers}
        />
      )}

      {/* Reassign modal */}
      {isOwner && (
        <Modal
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          title="Assign file"
        >
          <p className="mb-4 text-sm text-zinc-400">
            Choose who this file should be assigned to.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleReassign(undefined)}
              disabled={isReassigning}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                !assignedTo
                  ? "border-violet-500 bg-violet-500/10 text-zinc-100"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-400">
                <FileIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Unassigned</p>
                <p className="text-xs text-zinc-500">Family documents</p>
              </div>
            </button>
            {assignableMembers.map((member) => (
              <button
                key={member._id}
                onClick={() => handleReassign(member._id)}
                disabled={isReassigning}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  assignedTo === member._id
                    ? "border-violet-500 bg-violet-500/10 text-zinc-100"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
                  {member.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">
                    {member.name}
                    {member.role === "owner" ? " (Me)" : ""}
                  </p>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </div>
              </button>
            ))}
          </div>
          {isReassigning && (
            <p className="mt-4 text-center text-sm text-zinc-500">Saving...</p>
          )}
        </Modal>
      )}
    </>
  );
}
