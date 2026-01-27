"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "~/lib/utils";
import {
  FolderIcon,
  ShareIcon,
  TrashIcon,
  MoreIcon,
  UserIcon,
  EditIcon,
  MoveIcon,
} from "./icons";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { Input } from "./ui/input";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  email: string;
  imageUrl?: string;
  role?: "owner" | "member";
}

interface FolderCardProps {
  id: Id<"folders">;
  name: string;
  sharedWithFamily: boolean;
  sharedWith?: Id<"users">[];
  assignedTo?: Id<"users">;
  assigneeName?: string;
  itemCount: number;
  isOwner: boolean;
  familyMembers?: FamilyMember[];
  onClick: () => void;
  onMoveClick?: () => void;
}

export function FolderCard({
  id,
  name,
  sharedWithFamily,
  sharedWith = [],
  assignedTo,
  assigneeName,
  itemCount,
  isOwner,
  familyMembers = [],
  onClick,
  onMoveClick,
}: FolderCardProps) {
  const { user } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isSharingUpdating, setIsSharingUpdating] = useState(false);
  const [newName, setNewName] = useState(name);
  const [deleteContents, setDeleteContents] = useState(false);

  const deleteFolder = useMutation(api.folders.deleteFolder);
  const renameFolder = useMutation(api.folders.renameFolder);
  const updateAssignment = useMutation(api.folders.updateFolderAssignment);
  const updateSharing = useMutation(api.folders.updateFolderSharing);

  // Get non-owner members for assignment
  const assignableMembers = familyMembers.filter((m) => m.role !== "owner");

  // Check if current user can share this folder (owner OR folder is assigned to them)
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress;
  const currentMember = familyMembers.find((m) => m.email === currentUserEmail);
  const isAssignedToMe = currentMember && assignedTo === currentMember._id;
  const canShare = isOwner || isAssignedToMe;

  // Check if shared with specific members (not whole family)
  const isSharedWithSome = sharedWith.length > 0 && !sharedWithFamily;

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const result = await deleteFolder({
        folderId: id,
        deleteContents,
        clerkId: user.id,
      });

      // Delete files from UploadThing if needed
      if (result?.fileKeysToDelete?.length) {
        for (const fileKey of result.fileKeysToDelete) {
          await fetch("/api/uploadthing/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKey }),
          });
        }
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRename = async () => {
    if (!user || !newName.trim()) return;
    setIsRenaming(true);
    try {
      await renameFolder({
        folderId: id,
        newName: newName.trim(),
        clerkId: user.id,
      });
      setShowRenameModal(false);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleReassign = async (newAssignee?: Id<"users">) => {
    if (!user) return;
    setIsReassigning(true);
    try {
      await updateAssignment({
        folderId: id,
        assignedTo: newAssignee,
        clerkId: user.id,
      });
      setShowReassignModal(false);
    } finally {
      setIsReassigning(false);
    }
  };

  const handleShareUpdate = async (shareWithFamily: boolean, shareWith: Id<"users">[]) => {
    if (!user) return;
    setIsSharingUpdating(true);
    try {
      await updateSharing({
        folderId: id,
        shareWithFamily,
        sharedWith: shareWith,
        clerkId: user.id,
      });
      setShowShareModal(false);
    } finally {
      setIsSharingUpdating(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open folder if clicking menu button or dropdown
    if ((e.target as HTMLElement).closest("button")) return;
    onClick();
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700 hover:bg-zinc-800/50 active:bg-zinc-800"
      >
        <div className="p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <FolderIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="p-4 pt-0">
          <h3 className="mb-1 truncate font-medium text-zinc-100" title={name}>
            {name}
          </h3>

          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Assignee */}
          {assigneeName && (
            <p className="mt-2 text-xs text-zinc-500">
              Assigned to {assigneeName}
            </p>
          )}

          {/* Shared indicator */}
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
        </div>

        {/* Actions menu button */}
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
                onClick={() => {
                  setShowMenu(false);
                  onClick();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
              >
                <FolderIcon className="h-4 w-4" />
                Open folder
              </button>
              {canShare && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowShareModal(true);
                  }}
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
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setNewName(name);
                      setShowRenameModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
                  >
                    <EditIcon className="h-4 w-4" />
                    Rename
                  </button>
                  {onMoveClick && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onMoveClick();
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600"
                    >
                      <MoveIcon className="h-4 w-4" />
                      Move
                    </button>
                  )}
                  {assignableMembers.length > 0 && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowReassignModal(true);
                      }}
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
        title="Delete folder?"
      >
        <p className="mb-4 text-zinc-400">
          Are you sure you want to delete &ldquo;{name}&rdquo;?
        </p>
        {itemCount > 0 && (
          <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <p className="mb-2 text-sm text-zinc-300">
              This folder contains {itemCount} {itemCount === 1 ? "item" : "items"}.
            </p>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={deleteContents}
                onChange={(e) => setDeleteContents(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-700"
              />
              Delete all contents permanently
            </label>
            {!deleteContents && (
              <p className="mt-1 text-xs text-zinc-500">
                Contents will be moved to the parent folder.
              </p>
            )}
          </div>
        )}
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

      {/* Rename modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename folder"
      >
        <div className="mb-4">
          <Input
            placeholder="Folder name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
          />
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowRenameModal(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            loading={isRenaming}
            disabled={!newName.trim() || newName === name}
            className="flex-1"
          >
            Rename
          </Button>
        </div>
      </Modal>

      {/* Reassign modal */}
      {isOwner && (
        <Modal
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          title="Assign folder"
        >
          <p className="mb-4 text-sm text-zinc-400">
            Choose who this folder should be assigned to.
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
                <FolderIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Unassigned</p>
                <p className="text-xs text-zinc-500">Family folder</p>
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
                  <p className="font-medium">{member.name}</p>
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

      {/* Share modal */}
      {canShare && (
        <Modal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Share folder"
        >
          <p className="mb-4 text-sm text-zinc-400">
            Choose who can see this folder and its contents.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleShareUpdate(true, [])}
              disabled={isSharingUpdating}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                sharedWithFamily
                  ? "border-violet-500 bg-violet-500/10 text-zinc-100"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <ShareIcon className="h-5 w-5 text-violet-400" />
              <div>
                <p className="font-medium">Share with family</p>
                <p className="text-xs text-zinc-500">Everyone can see this folder</p>
              </div>
            </button>
            <button
              onClick={() => handleShareUpdate(false, [])}
              disabled={isSharingUpdating}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                !sharedWithFamily && sharedWith.length === 0
                  ? "border-violet-500 bg-violet-500/10 text-zinc-100"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <FolderIcon className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="font-medium">Private</p>
                <p className="text-xs text-zinc-500">Only you can see this folder</p>
              </div>
            </button>
          </div>
          {isSharingUpdating && (
            <p className="mt-4 text-center text-sm text-zinc-500">Saving...</p>
          )}
        </Modal>
      )}
    </>
  );
}
