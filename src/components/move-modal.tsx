"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { FolderIcon, HomeIcon, ChevronRightIcon, FamilyIcon } from "./icons";
import { cn } from "~/lib/utils";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  role?: "owner" | "member";
}

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "file" | "folder";
  itemId: Id<"files"> | Id<"folders">;
  itemName: string;
  currentFolderId?: Id<"folders">;
}

interface FolderNode {
  _id: Id<"folders">;
  name: string;
  parentFolderId?: Id<"folders">;
  assignedTo?: Id<"users">;
  children: FolderNode[];
}

interface GroupedFolders {
  memberId: string;
  memberName: string;
  isOwner: boolean;
  folders: FolderNode[];
}

export function MoveModal({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemName,
  currentFolderId,
}: MoveModalProps) {
  const { user } = useUser();
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | undefined>(
    currentFolderId
  );
  const [isMoving, setIsMoving] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  // Initialize all groups as expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string> | null>(null);

  const allFolders = useQuery(
    api.folders.getAllFoldersForPicker,
    user ? { clerkId: user.id } : "skip"
  );

  const userWithFamily = useQuery(
    api.users.getUserWithFamily,
    user ? { clerkId: user.id } : "skip"
  );

  const moveFile = useMutation(api.files.moveFile);
  const moveFolder = useMutation(api.folders.moveFolder);

  const members = userWithFamily?.members ?? [];

  // Build folder tree grouped by assignee
  const groupedFolderTree = useMemo(() => {
    if (!allFolders || !members.length) return [];

    // Create nodes
    const nodeMap = new Map<string, FolderNode>();
    allFolders.forEach((folder) => {
      nodeMap.set(folder._id, {
        ...folder,
        children: [],
      });
    });

    // Build tree - connect children to parents
    const rootNodes: FolderNode[] = [];
    allFolders.forEach((folder) => {
      const node = nodeMap.get(folder._id)!;
      if (folder.parentFolderId) {
        const parent = nodeMap.get(folder.parentFolderId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    // Sort children by name
    const sortChildren = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => sortChildren(node.children));
    };
    sortChildren(rootNodes);

    // Group root folders by assignee
    const groups: GroupedFolders[] = [];

    // Owner's folders first
    const ownerMember = members.find((m) => m.role === "owner");
    if (ownerMember) {
      const ownerFolders = rootNodes.filter((f) => f.assignedTo === ownerMember._id);
      if (ownerFolders.length > 0) {
        groups.push({
          memberId: ownerMember._id,
          memberName: ownerMember.name,
          isOwner: true,
          folders: ownerFolders,
        });
      }
    }

    // Other members' folders
    members
      .filter((m) => m.role !== "owner")
      .forEach((member) => {
        const memberFolders = rootNodes.filter((f) => f.assignedTo === member._id);
        if (memberFolders.length > 0) {
          groups.push({
            memberId: member._id,
            memberName: member.name,
            isOwner: false,
            folders: memberFolders,
          });
        }
      });

    // Unassigned/Family folders
    const unassignedFolders = rootNodes.filter((f) => !f.assignedTo);
    if (unassignedFolders.length > 0) {
      groups.push({
        memberId: "unassigned",
        memberName: "Family Folders",
        isOwner: false,
        folders: unassignedFolders,
      });
    }

    return groups;
  }, [allFolders, members]);

  // Auto-expand all groups when data loads
  const effectiveExpandedGroups = useMemo(() => {
    if (expandedGroups !== null) return expandedGroups;
    // Default: expand all groups
    return new Set(groupedFolderTree.map((g) => g.memberId));
  }, [expandedGroups, groupedFolderTree]);

  const handleMove = async () => {
    if (!user) return;

    // Don't move if selecting the same folder
    if (selectedFolderId === currentFolderId) {
      onClose();
      return;
    }

    setIsMoving(true);
    try {
      if (itemType === "file") {
        await moveFile({
          fileId: itemId as Id<"files">,
          folderId: selectedFolderId,
          clerkId: user.id,
        });
      } else {
        await moveFolder({
          folderId: itemId as Id<"folders">,
          newParentFolderId: selectedFolderId,
          clerkId: user.id,
        });
      }
      onClose();
    } finally {
      setIsMoving(false);
    }
  };

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    const current = effectiveExpandedGroups;
    const next = new Set(current);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setExpandedGroups(next);
  };

  // Check if a folder is a descendant of the item being moved (for folders only)
  const isDescendantOfItem = (folderId: Id<"folders">): boolean => {
    if (itemType !== "folder") return false;
    if (folderId === itemId) return true;

    const folder = allFolders?.find((f) => f._id === folderId);
    if (!folder?.parentFolderId) return false;
    return isDescendantOfItem(folder.parentFolderId);
  };

  const renderFolderNode = (node: FolderNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node._id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedFolderId === node._id;
    const isCurrentItem = itemType === "folder" && node._id === itemId;
    const isInvalidTarget = isDescendantOfItem(node._id);
    const isDisabled = isCurrentItem || isInvalidTarget;

    return (
      <div key={node._id}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
            isDisabled
              ? "cursor-not-allowed opacity-50"
              : isSelected
                ? "bg-violet-500/20 text-zinc-100"
                : "cursor-pointer hover:bg-zinc-800 text-zinc-300"
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => !isDisabled && setSelectedFolderId(node._id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node._id);
              }}
              className="p-0.5 hover:bg-zinc-700 rounded"
            >
              <ChevronRightIcon
                className={cn(
                  "h-4 w-4 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          )}
          {!hasChildren && <div className="w-5" />}
          <FolderIcon className="h-4 w-4 text-amber-400" />
          <span className="truncate">{node.name}</span>
          {isCurrentItem && (
            <span className="ml-auto text-xs text-zinc-500">(current)</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Move ${itemType}`}>
      <p className="mb-4 text-sm text-zinc-400">
        Select a destination for &ldquo;{itemName}&rdquo;
      </p>

      <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/50">
        {/* Root option */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
            selectedFolderId === undefined
              ? "bg-violet-500/20 text-zinc-100"
              : "cursor-pointer hover:bg-zinc-800 text-zinc-300"
          )}
          onClick={() => setSelectedFolderId(undefined)}
        >
          <div className="w-5" />
          <HomeIcon className="h-4 w-4 text-zinc-400" />
          <span>Root (no folder)</span>
          {currentFolderId === undefined && (
            <span className="ml-auto text-xs text-zinc-500">(current)</span>
          )}
        </div>

        {/* Grouped folder tree */}
        {groupedFolderTree.map((group) => {
          const isGroupExpanded = effectiveExpandedGroups.has(group.memberId);
          return (
            <div key={group.memberId} className="border-b border-zinc-700/50 last:border-b-0">
              <button
                onClick={() => toggleGroup(group.memberId)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-zinc-800/50",
                  group.isOwner ? "text-violet-400" : "text-zinc-400"
                )}
              >
                <ChevronRightIcon
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isGroupExpanded && "rotate-90"
                  )}
                />
                {group.memberId === "unassigned" ? (
                  <FamilyIcon className="h-4 w-4" />
                ) : (
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      group.isOwner ? "bg-violet-500/20" : "bg-zinc-700"
                    )}
                  >
                    {group.memberName[0]?.toUpperCase()}
                  </span>
                )}
                <span>
                  {group.memberId === "unassigned"
                    ? "Family Folders"
                    : `${group.memberName}'s Folders`}
                </span>
                <span className="ml-auto text-xs text-zinc-500">
                  ({group.folders.length})
                </span>
              </button>
              {isGroupExpanded && (
                <div className="pb-1">
                  {group.folders.map((node) => renderFolderNode(node, 0))}
                </div>
              )}
            </div>
          );
        })}

        {(!allFolders || allFolders.length === 0) && (
          <p className="p-4 text-center text-sm text-zinc-500">
            No folders available
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          loading={isMoving}
          disabled={selectedFolderId === currentFolderId}
          className="flex-1"
        >
          Move here
        </Button>
      </div>
    </Modal>
  );
}
