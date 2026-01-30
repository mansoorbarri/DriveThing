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
  selectedFileIds: Set<Id<"files">>;
  selectedFolderIds: Set<Id<"folders">>;
  onClearSelection: () => void;
  familyMembers: FamilyMember[];
}

export function BulkActionBar({
  selectedFileIds,
  selectedFolderIds,
  onClearSelection,
  familyMembers,
}: BulkActionBarProps) {
  const { user } = useUser();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const bulkDeleteFiles = useMutation(api.files.bulkDeleteFiles);
  const bulkMoveFiles = useMutation(api.files.bulkMoveFiles);
  const bulkAssignFiles = useMutation(api.files.bulkAssignFiles);
  const bulkDeleteFolders = useMutation(api.folders.bulkDeleteFolders);
  const bulkMoveFolders = useMutation(api.folders.bulkMoveFolders);
  const bulkAssignFolders = useMutation(api.folders.bulkAssignFolders);

  const allFolders = useQuery(
    api.folders.getAllFoldersForPicker,
    user ? { clerkId: user.id } : "skip"
  );

  const fileCount = selectedFileIds.size;
  const folderCount = selectedFolderIds.size;
  const totalCount = fileCount + folderCount;

  const handleBulkDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      // Get the current selection at call time
      const fileIdsToDelete = Array.from(selectedFileIds);
      const folderIdsToDelete = Array.from(selectedFolderIds);

      // Delete files
      if (fileIdsToDelete.length > 0) {
        const result = await bulkDeleteFiles({
          fileIds: fileIdsToDelete,
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
      }

      // Delete folders
      if (folderIdsToDelete.length > 0) {
        const result = await bulkDeleteFolders({
          folderIds: folderIdsToDelete,
          deleteContents: true,
          clerkId: user.id,
        });

        // Delete files inside folders from UploadThing storage
        if (result?.fileKeysToDelete && result.fileKeysToDelete.length > 0) {
          await fetch("/api/uploadthing/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileKeys: result.fileKeysToDelete }),
          });
        }
      }

      onClearSelection();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete items:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkMove = async (folderId?: Id<"folders">) => {
    if (!user) return;
    setIsMoving(true);
    try {
      // Get the current selection at call time
      const fileIdsToMove = Array.from(selectedFileIds);
      const folderIdsToMove = Array.from(selectedFolderIds);

      // Move files
      if (fileIdsToMove.length > 0) {
        await bulkMoveFiles({
          fileIds: fileIdsToMove,
          folderId,
          clerkId: user.id,
        });
      }
      // Move folders
      if (folderIdsToMove.length > 0) {
        await bulkMoveFolders({
          folderIds: folderIdsToMove,
          newParentFolderId: folderId,
          clerkId: user.id,
        });
      }
      onClearSelection();
      setShowMoveModal(false);
    } catch (error) {
      console.error("Failed to move items:", error);
    } finally {
      setIsMoving(false);
    }
  };

  const handleBulkAssign = async (assignedTo?: Id<"users">) => {
    if (!user) return;
    setIsAssigning(true);
    try {
      // Get the current selection at call time
      const fileIdsToAssign = Array.from(selectedFileIds);
      const folderIdsToAssign = Array.from(selectedFolderIds);

      // Assign files
      if (fileIdsToAssign.length > 0) {
        await bulkAssignFiles({
          fileIds: fileIdsToAssign,
          assignedTo,
          clerkId: user.id,
        });
      }
      // Assign folders
      if (folderIdsToAssign.length > 0) {
        await bulkAssignFolders({
          folderIds: folderIdsToAssign,
          assignedTo,
          clerkId: user.id,
        });
      }
      onClearSelection();
      setShowAssignModal(false);
    } catch (error) {
      console.error("Failed to assign items:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  if (totalCount === 0) return null;

  // Build selection text
  const getSelectionText = () => {
    const parts = [];
    if (fileCount > 0) {
      parts.push(`${fileCount} ${fileCount === 1 ? "file" : "files"}`);
    }
    if (folderCount > 0) {
      parts.push(`${folderCount} ${folderCount === 1 ? "folder" : "folders"}`);
    }
    return parts.join(" and ");
  };

  const getItemText = () => {
    if (fileCount > 0 && folderCount > 0) {
      return `${totalCount} items`;
    }
    if (folderCount > 0) {
      return `${folderCount} ${folderCount === 1 ? "folder" : "folders"}`;
    }
    return `${fileCount} ${fileCount === 1 ? "file" : "files"}`;
  };

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
              {getSelectionText()} selected
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
        title={`Delete ${getItemText()}?`}
      >
        <p className="mb-6 text-zinc-400">
          Are you sure you want to delete {getSelectionText()}? This cannot be undone.
          {folderCount > 0 && " All contents inside the selected folders will also be deleted."}
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
            Delete {getItemText()}
          </Button>
        </div>
      </Modal>

      {/* Move modal */}
      {showMoveModal && (
        <BulkMoveModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          itemText={getItemText()}
          onMove={handleBulkMove}
          isMoving={isMoving}
        />
      )}

      {/* Assign modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Assign ${getItemText()}`}
      >
        <p className="mb-4 text-sm text-zinc-400">
          Choose who {totalCount === 1 ? "this" : "these"} {fileCount > 0 && folderCount > 0 ? "items" : fileCount > 0 ? (fileCount === 1 ? "file" : "files") : (folderCount === 1 ? "folder" : "folders")} should be assigned to.
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
  itemText,
  onMove,
  isMoving,
}: {
  isOpen: boolean;
  onClose: () => void;
  itemText: string;
  onMove: (folderId?: Id<"folders">) => Promise<void>;
  isMoving: boolean;
}) {
  const { user } = useUser();
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | undefined>();
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
    await onMove(selectedFolderId);
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Move ${itemText}`}>
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

        {/* Grouped folders - owner first, then alphabetically, family folders handled separately */}
        {[...members]
          .sort((a, b) => {
            // Owner first
            if (a.role === "owner" && b.role !== "owner") return -1;
            if (b.role === "owner" && a.role !== "owner") return 1;
            // Then alphabetically
            return a.name.localeCompare(b.name);
          })
          .map((member) => {
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
          Move {itemText}
        </Button>
      </div>
    </Modal>
  );
}
