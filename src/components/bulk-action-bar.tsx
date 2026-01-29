"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { MoveModal } from "./move-modal";
import {
  TrashIcon,
  MoveIcon,
  UserIcon,
  CloseIcon,
  FileIcon,
} from "./icons";
import { cn } from "~/lib/utils";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  email: string;
  imageUrl?: string;
  role?: "owner" | "member";
}

interface BulkActionBarProps {
  selectedIds: Set<Id<"files">>;
  onClearSelection: () => void;
  familyMembers: FamilyMember[];
}

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  familyMembers,
}: BulkActionBarProps) {
  const { user } = useUser();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const bulkDeleteFiles = useMutation(api.files.bulkDeleteFiles);
  const bulkMoveFiles = useMutation(api.files.bulkMoveFiles);
  const bulkAssignFiles = useMutation(api.files.bulkAssignFiles);

  const allFolders = useQuery(
    api.folders.getAllFoldersForPicker,
    user ? { clerkId: user.id } : "skip"
  );

  const count = selectedIds.size;

  const handleBulkDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const result = await bulkDeleteFiles({
        fileIds: Array.from(selectedIds),
        clerkId: user.id,
      });

      // Delete from UploadThing storage
      if (result?.fileKeys && result.fileKeys.length > 0) {
        await fetch("/api/uploadthing/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileKeys: result.fileKeys }),
        });
      }

      onClearSelection();
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkMove = async (folderId?: Id<"folders">) => {
    if (!user) return;
    await bulkMoveFiles({
      fileIds: Array.from(selectedIds),
      folderId,
      clerkId: user.id,
    });
    onClearSelection();
    setShowMoveModal(false);
  };

  const handleBulkAssign = async (assignedTo?: Id<"users">) => {
    if (!user) return;
    setIsAssigning(true);
    try {
      await bulkAssignFiles({
        fileIds: Array.from(selectedIds),
        assignedTo,
        clerkId: user.id,
      });
      onClearSelection();
      setShowAssignModal(false);
    } finally {
      setIsAssigning(false);
    }
  };

  if (count === 0) return null;

  return (
    <>
      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-700 bg-zinc-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Clear selection"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-zinc-200">
              {count} {count === 1 ? "file" : "files"} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAssignModal(true)}
              className="gap-2"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Assign</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowMoveModal(true)}
              className="gap-2"
            >
              <MoveIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Move</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2"
            >
              <TrashIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Delete ${count} ${count === 1 ? "file" : "files"}?`}
      >
        <p className="mb-6 text-zinc-400">
          Are you sure you want to delete {count}{" "}
          {count === 1 ? "file" : "files"}? This cannot be undone.
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
            onClick={handleBulkDelete}
            loading={isDeleting}
            className="flex-1"
          >
            Delete {count} {count === 1 ? "file" : "files"}
          </Button>
        </div>
      </Modal>

      {/* Move modal */}
      {showMoveModal && (
        <BulkMoveModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          count={count}
          onMove={handleBulkMove}
        />
      )}

      {/* Assign modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Assign ${count} ${count === 1 ? "file" : "files"}`}
      >
        <p className="mb-4 text-sm text-zinc-400">
          Choose who these files should be assigned to.
        </p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          <button
            onClick={() => handleBulkAssign(undefined)}
            disabled={isAssigning}
            className="flex w-full items-center gap-3 rounded-lg border border-zinc-700 p-3 text-left text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-400">
              <FileIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">Unassigned</p>
              <p className="text-xs text-zinc-500">Family documents</p>
            </div>
          </button>
          {familyMembers.map((member) => (
            <button
              key={member._id}
              onClick={() => handleBulkAssign(member._id)}
              disabled={isAssigning}
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-700 p-3 text-left text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
                {member.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium">
                  {member.name}
                  {member.role === "owner" ? " (Owner)" : ""}
                </p>
                <p className="text-xs text-zinc-500">{member.email}</p>
              </div>
            </button>
          ))}
        </div>
        {isAssigning && (
          <p className="mt-4 text-center text-sm text-zinc-500">Assigning...</p>
        )}
      </Modal>
    </>
  );
}

// Simplified move modal for bulk operations
function BulkMoveModal({
  isOpen,
  onClose,
  count,
  onMove,
}: {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  onMove: (folderId?: Id<"folders">) => Promise<void>;
}) {
  const { user } = useUser();
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | undefined>();
  const [isMoving, setIsMoving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const allFolders = useQuery(
    api.folders.getAllFoldersForPicker,
    user ? { clerkId: user.id } : "skip"
  );

  const userWithFamily = useQuery(
    api.users.getUserWithFamily,
    user ? { clerkId: user.id } : "skip"
  );

  const members = userWithFamily?.members ?? [];

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await onMove(selectedFolderId);
    } finally {
      setIsMoving(false);
    }
  };

  // Group folders by assignee
  const groupedFolders = allFolders?.reduce(
    (acc, folder) => {
      if (!folder.parentFolderId) {
        const key = folder.assignedTo ?? "unassigned";
        acc[key] = acc[key] || [];
        acc[key].push(folder);
      }
      return acc;
    },
    {} as Record<string, typeof allFolders>
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Move ${count} files`}>
      <p className="mb-4 text-sm text-zinc-400">
        Select a destination folder.
      </p>

      <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/50">
        {/* Root option */}
        <button
          onClick={() => setSelectedFolderId(undefined)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
            selectedFolderId === undefined
              ? "bg-violet-500/20 text-zinc-100"
              : "text-zinc-300 hover:bg-zinc-800"
          )}
        >
          <span>Root (no folder)</span>
        </button>

        {/* Grouped folders */}
        {members.map((member) => {
          const memberFolders = groupedFolders?.[member._id] ?? [];
          if (memberFolders.length === 0) return null;
          const isExpanded = expandedGroups.has(member._id);
          const isOwner = member.role === "owner";
          return (
            <div key={member._id} className="border-t border-zinc-700/50">
              <button
                onClick={() => toggleGroup(member._id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium",
                  isOwner ? "text-violet-400" : "text-zinc-400"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    isOwner ? "bg-violet-500/20" : "bg-zinc-700"
                  )}
                >
                  {member.name[0]?.toUpperCase()}
                </span>
                {member.name}&apos;s Folders ({memberFolders.length})
              </button>
              {isExpanded &&
                memberFolders.map((folder) => (
                  <button
                    key={folder._id}
                    onClick={() => setSelectedFolderId(folder._id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 pl-10 text-left transition-colors",
                      selectedFolderId === folder._id
                        ? "bg-violet-500/20 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800"
                    )}
                  >
                    {folder.name}
                  </button>
                ))}
            </div>
          );
        })}

        {/* Unassigned folders */}
        {groupedFolders?.unassigned && groupedFolders.unassigned.length > 0 && (
          <div className="border-t border-zinc-700/50">
            <button
              onClick={() => toggleGroup("unassigned")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-400"
            >
              Family Folders ({groupedFolders.unassigned.length})
            </button>
            {expandedGroups.has("unassigned") &&
              groupedFolders.unassigned.map((folder) => (
                <button
                  key={folder._id}
                  onClick={() => setSelectedFolderId(folder._id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 pl-10 text-left transition-colors",
                    selectedFolderId === folder._id
                      ? "bg-violet-500/20 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-800"
                  )}
                >
                  {folder.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleMove} loading={isMoving} className="flex-1">
          Move {count} {count === 1 ? "file" : "files"}
        </Button>
      </div>
    </Modal>
  );
}
