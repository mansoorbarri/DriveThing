"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Header } from "~/components/header";
import { FileCard } from "~/components/file-card";
import { FolderCard } from "~/components/folder-card";
import { FileUploader } from "~/components/file-uploader";
import { FamilySetup } from "~/components/family-setup";
import { FamilySettings } from "~/components/family-settings";
import { CreateFolderModal } from "~/components/create-folder-modal";
import { FolderBreadcrumb } from "~/components/folder-breadcrumb";
import { MoveModal } from "~/components/move-modal";
import { BulkActionBar } from "~/components/bulk-action-bar";
import { EmptyState } from "~/components/ui/empty-state";
import { Modal } from "~/components/ui/modal";
import {
  FileGridSkeleton,
  DashboardSkeleton,
  GroupedFilesSkeleton,
} from "~/components/ui/skeleton";
import { PlusIcon, FileIcon, UploadIcon, FolderIcon, ChevronRightIcon } from "~/components/icons";
import { cn } from "~/lib/utils";

type Tab = "my-files" | "shared";

interface MoveTarget {
  type: "file" | "folder";
  id: Id<"files"> | Id<"folders">;
  name: string;
  currentFolderId?: Id<"folders">;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>("my-files");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploader, setShowUploader] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<Id<"folders"> | undefined>();
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  // Track sections that user has manually toggled (stores the toggled state)
  const [toggledSections, setToggledSections] = useState<Map<string, boolean>>(new Map());
  // Track selected files for bulk actions
  const [selectedFiles, setSelectedFiles] = useState<Set<Id<"files">>>(new Set());
  // Floating action button menu
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Sync user with Convex
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (user) {
      void getOrCreateUser({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        name: user.fullName ?? user.firstName ?? "User",
        imageUrl: user.imageUrl,
      });
    }
  }, [user, getOrCreateUser]);

  // Fetch user with family info
  const userWithFamily = useQuery(
    api.users.getUserWithFamily,
    user ? { clerkId: user.id } : "skip"
  );

  // Fetch folders (for normal browsing)
  const myFoldersInParent = useQuery(
    api.folders.getMyFolders,
    user ? { clerkId: user.id, parentFolderId: currentFolderId } : "skip"
  );

  const sharedFoldersInParent = useQuery(
    api.folders.getSharedFolders,
    user ? { clerkId: user.id, parentFolderId: currentFolderId } : "skip"
  );

  // Fetch ALL folders for global search
  const allMyFolders = useQuery(
    api.folders.getMyFolders,
    user && searchQuery ? { clerkId: user.id, all: true } : "skip"
  );

  const allSharedFolders = useQuery(
    api.folders.getSharedFolders,
    user && searchQuery ? { clerkId: user.id, all: true } : "skip"
  );

  // Use global folders when searching, parent-filtered folders otherwise
  const myFolders = searchQuery ? allMyFolders : myFoldersInParent;
  const sharedFolders = searchQuery ? allSharedFolders : sharedFoldersInParent;

  // Fetch folder path for breadcrumbs
  const folderPath = useQuery(
    api.folders.getFolderPath,
    user && currentFolderId ? { clerkId: user.id, folderId: currentFolderId } : "skip"
  );

  // Fetch all folders for picker
  const allFolders = useQuery(
    api.folders.getAllFoldersForPicker,
    user ? { clerkId: user.id } : "skip"
  );

  // Fetch files with folder filter (for normal browsing)
  const myFilesInFolder = useQuery(
    api.files.getMyFiles,
    user
      ? {
          clerkId: user.id,
          folderId: currentFolderId,
          rootOnly: !currentFolderId,
        }
      : "skip"
  );

  const sharedFilesInFolder = useQuery(
    api.files.getSharedFiles,
    user
      ? {
          clerkId: user.id,
          folderId: currentFolderId,
          rootOnly: !currentFolderId,
        }
      : "skip"
  );

  // Fetch ALL files for global search
  const allMyFiles = useQuery(
    api.files.getMyFiles,
    user && searchQuery ? { clerkId: user.id } : "skip"
  );

  const allSharedFiles = useQuery(
    api.files.getSharedFiles,
    user && searchQuery ? { clerkId: user.id } : "skip"
  );

  // Use global files when searching, folder files otherwise
  const myFiles = searchQuery ? allMyFiles : myFilesInFolder;
  const sharedFiles = searchQuery ? allSharedFiles : sharedFilesInFolder;

  // Build folder name lookup map
  const folderNameMap = useMemo(() => {
    if (!allFolders) return new Map<string, string>();
    return new Map(allFolders.map((f) => [f._id, f.name]));
  }, [allFolders]);

  // Filter files and folders by search (name, tags, folder name, assignee name)
  const filteredMyFolders = useMemo(() => {
    if (!myFolders) return [];
    if (!searchQuery) return myFolders;
    const term = searchQuery.toLowerCase();
    return myFolders.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.assigneeName?.toLowerCase().includes(term)
    );
  }, [myFolders, searchQuery]);

  const filteredMyFiles = useMemo(() => {
    if (!myFiles) return [];
    if (!searchQuery) return myFiles;
    const term = searchQuery.toLowerCase();
    return myFiles.filter((f) => {
      // Match file name
      if (f.name.toLowerCase().includes(term)) return true;
      // Match tags
      if (f.tags?.some((tag) => tag.toLowerCase().includes(term))) return true;
      // Match folder name
      if (f.folderId) {
        const folderName = folderNameMap.get(f.folderId);
        if (folderName?.toLowerCase().includes(term)) return true;
      }
      // Match assignee name
      if (f.assigneeName?.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [myFiles, searchQuery, folderNameMap]);

  const filteredSharedFolders = useMemo(() => {
    if (!sharedFolders) return [];
    if (!searchQuery) return sharedFolders;
    const term = searchQuery.toLowerCase();
    return sharedFolders.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.assigneeName?.toLowerCase().includes(term)
    );
  }, [sharedFolders, searchQuery]);

  const filteredSharedFiles = useMemo(() => {
    if (!sharedFiles) return [];
    if (!searchQuery) return sharedFiles;
    const term = searchQuery.toLowerCase();
    return sharedFiles.filter((f) => {
      // Match file name
      if (f.name.toLowerCase().includes(term)) return true;
      // Match tags
      if (f.tags?.some((tag) => tag.toLowerCase().includes(term))) return true;
      // Match folder name
      if (f.folderId) {
        const folderName = folderNameMap.get(f.folderId);
        if (folderName?.toLowerCase().includes(term)) return true;
      }
      // Match assignee name
      if (f.assigneeName?.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [sharedFiles, searchQuery, folderNameMap]);

  // Group files by assignee for owner view
  const groupedFiles = useMemo(() => {
    if (!filteredMyFiles || !userWithFamily) return null;

    const currentUserRole = userWithFamily.user?.role;
    if (currentUserRole !== "owner") return null;

    const familyMembers = userWithFamily.members;
    const groups: Record<string, typeof filteredMyFiles> = {
      unassigned: [],
    };

    // Create groups for each member (including owner)
    familyMembers.forEach((m) => {
      groups[m._id] = [];
    });

    // Sort files into groups
    filteredMyFiles.forEach((file) => {
      if (file.assignedTo) {
        const targetGroup = groups[file.assignedTo];
        if (targetGroup) {
          targetGroup.push(file);
        } else {
          groups.unassigned?.push(file);
        }
      } else {
        groups.unassigned?.push(file);
      }
    });

    return groups;
  }, [filteredMyFiles, userWithFamily]);

  // Group shared files by assignee
  const groupedSharedFiles = useMemo(() => {
    if (!filteredSharedFiles || filteredSharedFiles.length === 0) return null;

    const groups: Record<
      string,
      { assigneeName: string; files: typeof filteredSharedFiles }
    > = {};

    filteredSharedFiles.forEach((file) => {
      const assigneeId = file.assignedTo ?? "unassigned";
      groups[assigneeId] ??= {
        assigneeName: file.assigneeName ?? "Family Documents",
        files: [],
      };
      groups[assigneeId].files.push(file);
    });

    return groups;
  }, [filteredSharedFiles]);

  // Get current folder's assignee for default file assignment
  const currentFolderAssignee = useMemo(() => {
    if (!currentFolderId || !allFolders) return undefined;
    const currentFolder = allFolders.find((f) => f._id === currentFolderId);
    return currentFolder?.assignedTo;
  }, [currentFolderId, allFolders]);

  // Navigate to folder
  const navigateToFolder = (folderId?: Id<"folders">) => {
    setCurrentFolderId(folderId);
    setSearchQuery("");
    setSelectedFiles(new Set()); // Clear selection when navigating
  };

  // Loading state
  if (!isLoaded || userWithFamily === undefined) {
    return <DashboardSkeleton />;
  }

  // Not in a family yet - show setup
  if (!userWithFamily?.family) {
    return (
      <main className="min-h-screen bg-[#0a0a0b]">
        <FamilySetup />
      </main>
    );
  }

  const { family, members } = userWithFamily;
  const currentUser = userWithFamily.user;
  const isOwner = currentUser?.role === "owner";

  // Get current user's member ID for default expanded section
  const currentUserMemberId = currentUser?._id;

  // Check if a section should be expanded
  // Default: current user's section is expanded, others are collapsed
  const isSectionExpanded = (sectionId: string) => {
    // If user has manually toggled this section, use that state
    if (toggledSections.has(sectionId)) {
      return toggledSections.get(sectionId)!;
    }
    // Default: only current user's section is expanded
    return sectionId === currentUserMemberId;
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setToggledSections((prev) => {
      const next = new Map(prev);
      const currentState = isSectionExpanded(sectionId);
      next.set(sectionId, !currentState);
      return next;
    });
  };

  // Toggle file selection
  const toggleFileSelection = (fileId: Id<"files">) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Select all files in a group
  const selectAllInGroup = (fileIds: Id<"files">[]) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      fileIds.forEach((id) => next.add(id));
      return next;
    });
  };

  // Deselect all files in a group
  const deselectAllInGroup = (fileIds: Id<"files">[]) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      fileIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  // Check if all files in a group are selected
  const areAllSelected = (fileIds: Id<"files">[]) => {
    if (fileIds.length === 0) return false;
    return fileIds.every((id) => selectedFiles.has(id));
  };

  // Check if some (but not all) files in a group are selected
  const areSomeSelected = (fileIds: Id<"files">[]) => {
    if (fileIds.length === 0) return false;
    const selectedCount = fileIds.filter((id) => selectedFiles.has(id)).length;
    return selectedCount > 0 && selectedCount < fileIds.length;
  };

  // Toggle select all for a group
  const toggleSelectAll = (fileIds: Id<"files">[]) => {
    if (areAllSelected(fileIds)) {
      deselectAllInGroup(fileIds);
    } else {
      selectAllInGroup(fileIds);
    }
  };

  // Check if we're in selection mode
  const selectionMode = selectedFiles.size > 0;

  // Render file card with move handler
  const renderFileCard = (file: (typeof filteredMyFiles)[0]) => (
    <FileCard
      key={file._id}
      id={file._id}
      name={file.name}
      url={file.url}
      type={file.type}
      size={file.size}
      createdAt={file.createdAt}
      sharedWithFamily={file.sharedWithFamily}
      sharedWith={file.sharedWith ?? []}
      tags={file.tags ?? []}
      assignedTo={file.assignedTo}
      assigneeName={file.assigneeName}
      isOwner={isOwner}
      familyMembers={members}
      folderId={file.folderId}
      folderName={searchQuery && file.folderId ? folderNameMap.get(file.folderId) : undefined}
      onMoveClick={
        isOwner
          ? () =>
              setMoveTarget({
                type: "file",
                id: file._id,
                name: file.name,
                currentFolderId: file.folderId,
              })
          : undefined
      }
      selectionMode={selectionMode}
      isSelected={selectedFiles.has(file._id)}
      onToggleSelect={toggleFileSelection}
    />
  );

  // Render folder card with handlers
  const renderFolderCard = (folder: (typeof filteredMyFolders)[0]) => (
    <FolderCard
      key={folder._id}
      id={folder._id}
      name={folder.name}
      sharedWithFamily={folder.sharedWithFamily}
      sharedWith={folder.sharedWith ?? []}
      assignedTo={folder.assignedTo}
      assigneeName={folder.assigneeName}
      itemCount={folder.itemCount}
      isOwner={isOwner}
      familyMembers={members}
      parentFolderName={searchQuery && folder.parentFolderId ? folderNameMap.get(folder.parentFolderId) : undefined}
      onClick={() => navigateToFolder(folder._id)}
      onMoveClick={
        isOwner
          ? () =>
              setMoveTarget({
                type: "folder",
                id: folder._id,
                name: folder.name,
                currentFolderId: folder.parentFolderId,
              })
          : undefined
      }
    />
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Header
        familyName={family.name}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSettingsClick={() => setShowSettings(true)}
      />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-zinc-900 p-1">
          <button
            onClick={() => {
              setActiveTab("my-files");
              setCurrentFolderId(undefined);
              setSelectedFiles(new Set());
            }}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "my-files"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {isOwner ? "All Files" : "My Files"}
            {myFiles && myFiles.length > 0 && (
              <span className="ml-1.5 text-zinc-500">({myFiles.length})</span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("shared");
              setCurrentFolderId(undefined);
              setSelectedFiles(new Set());
            }}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "shared"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            Shared with me
            {sharedFiles && sharedFiles.length > 0 && (
              <span className="ml-1.5 text-zinc-500">
                ({sharedFiles.length})
              </span>
            )}
          </button>
        </div>

        {/* Breadcrumb */}
        {currentFolderId && folderPath && folderPath.length > 0 && (
          <FolderBreadcrumb path={folderPath} onNavigate={navigateToFolder} />
        )}

        {/* My Files tab */}
        {activeTab === "my-files" && (
          <>
            {myFiles === undefined || myFolders === undefined ? (
              isOwner ? (
                <GroupedFilesSkeleton />
              ) : (
                <FileGridSkeleton />
              )
            ) : filteredMyFolders.length === 0 && filteredMyFiles.length === 0 ? (
              <EmptyState
                icon={
                  currentFolderId ? (
                    <FolderIcon className="h-8 w-8" />
                  ) : (
                    <FileIcon className="h-8 w-8" />
                  )
                }
                title={
                  searchQuery
                    ? "No items found"
                    : currentFolderId
                      ? "Empty folder"
                      : "No files yet"
                }
                description={
                  searchQuery
                    ? "Try a different search term"
                    : isOwner
                      ? currentFolderId
                        ? "Upload files or create subfolders"
                        : "Upload your first file to get started"
                      : "Files assigned to you will appear here"
                }
                action={
                  !searchQuery &&
                  isOwner && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCreateFolder(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-medium text-zinc-200 hover:bg-zinc-800"
                      >
                        <FolderIcon className="h-5 w-5" />
                        New folder
                      </button>
                      <button
                        onClick={() => setShowUploader(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
                      >
                        <UploadIcon className="h-5 w-5" />
                        Upload files
                      </button>
                    </div>
                  )
                }
              />
            ) : isOwner && groupedFiles ? (
              // Grouped view for owners
              <div className="space-y-8">
                {/* Owner's folders and files first */}
                {(() => {
                  const ownerMember = members.find((m) => m.role === "owner");
                  if (!ownerMember) return null;
                  const ownerFolders = filteredMyFolders.filter(
                    (f) => f.assignedTo === ownerMember._id
                  );
                  const ownerFiles = groupedFiles[ownerMember?._id ?? ""] ?? [];
                  if (ownerFolders.length === 0 && ownerFiles.length === 0) return null;
                  const isExpanded = isSectionExpanded(ownerMember._id);
                  const fileIds = ownerFiles.map((f) => f._id);
                  const allSelected = areAllSelected(fileIds);
                  const someSelected = areSomeSelected(fileIds);
                  return (
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleSection(ownerMember._id)}
                          className="flex items-center gap-2 text-left text-sm font-medium text-violet-400 hover:text-violet-300"
                        >
                          <ChevronRightIcon
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-xs">
                            {ownerMember?.name[0]?.toUpperCase()}
                          </span>
                          {ownerMember?.name}&apos;s Items ({ownerFolders.length + ownerFiles.length})
                        </button>
                        {ownerFiles.length > 0 && (
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-violet-500/10",
                              allSelected ? "text-violet-400" : "text-zinc-500"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                                allSelected
                                  ? "border-violet-500 bg-violet-500"
                                  : someSelected
                                    ? "border-violet-500 bg-violet-500/50"
                                    : "border-zinc-600"
                              )}
                            >
                              {(allSelected || someSelected) && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d={allSelected ? "M5 13l4 4L19 7" : "M20 12H4"} />
                                </svg>
                              )}
                            </span>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleSelectAll(fileIds)}
                              className="sr-only"
                            />
                            Select all
                          </label>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {ownerFolders.map(renderFolderCard)}
                          {ownerFiles.map((file) => renderFileCard(file))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Other members' folders and files */}
                {members
                  .filter((m) => m.role !== "owner")
                  .map((member) => {
                    const memberFolders = filteredMyFolders.filter(
                      (f) => f.assignedTo === member._id
                    );
                    const memberFiles = groupedFiles[member._id] ?? [];
                    if (memberFolders.length === 0 && memberFiles.length === 0) return null;
                    const isExpanded = isSectionExpanded(member._id);
                    const fileIds = memberFiles.map((f) => f._id);
                    const allSelected = areAllSelected(fileIds);
                    const someSelected = areSomeSelected(fileIds);
                    return (
                      <div key={member._id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleSection(member._id)}
                            className="flex items-center gap-2 text-left text-sm font-medium text-zinc-400 hover:text-zinc-300"
                          >
                            <ChevronRightIcon
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90"
                              )}
                            />
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-300">
                              {member.name[0]?.toUpperCase()}
                            </span>
                            {member.name}&apos;s Items ({memberFolders.length + memberFiles.length})
                          </button>
                          {memberFiles.length > 0 && (
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-zinc-800",
                                allSelected ? "text-violet-400" : "text-zinc-500"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                                  allSelected
                                    ? "border-violet-500 bg-violet-500"
                                    : someSelected
                                      ? "border-violet-500 bg-violet-500/50"
                                      : "border-zinc-600"
                                )}
                              >
                                {(allSelected || someSelected) && (
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={allSelected ? "M5 13l4 4L19 7" : "M20 12H4"} />
                                  </svg>
                                )}
                              </span>
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => toggleSelectAll(fileIds)}
                                className="sr-only"
                              />
                              Select all
                            </label>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {memberFolders.map(renderFolderCard)}
                            {memberFiles.map((file) => renderFileCard(file))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Family items (unassigned folders and files) */}
                {(() => {
                  const unassignedFolders = filteredMyFolders.filter((f) => !f.assignedTo);
                  const unassignedFiles = groupedFiles.unassigned ?? [];
                  if (unassignedFolders.length === 0 && unassignedFiles.length === 0) return null;
                  const isExpanded = isSectionExpanded("unassigned");
                  const fileIds = unassignedFiles.map((f) => f._id);
                  const allSelected = areAllSelected(fileIds);
                  const someSelected = areSomeSelected(fileIds);
                  return (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleSection("unassigned")}
                          className="flex items-center gap-2 text-left text-sm font-medium text-zinc-400 hover:text-zinc-300"
                        >
                          <ChevronRightIcon
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                          Family Items ({unassignedFolders.length + unassignedFiles.length})
                        </button>
                        {unassignedFiles.length > 0 && (
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-zinc-800",
                              allSelected ? "text-violet-400" : "text-zinc-500"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                                allSelected
                                  ? "border-violet-500 bg-violet-500"
                                  : someSelected
                                    ? "border-violet-500 bg-violet-500/50"
                                    : "border-zinc-600"
                              )}
                            >
                              {(allSelected || someSelected) && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d={allSelected ? "M5 13l4 4L19 7" : "M20 12H4"} />
                                </svg>
                              )}
                            </span>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleSelectAll(fileIds)}
                              className="sr-only"
                            />
                            Select all
                          </label>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {unassignedFolders.map(renderFolderCard)}
                          {unassignedFiles.map((file) => renderFileCard(file))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Grouped view for members - Folders + My Files + Family Documents
              <div className="space-y-8">
                {/* Folders first */}
                {filteredMyFolders.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-zinc-400">
                      Folders ({filteredMyFolders.length})
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredMyFolders.map(renderFolderCard)}
                    </div>
                  </div>
                )}

                {/* Files assigned to me */}
                {filteredMyFiles.filter((f) => f.assignedTo).length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-zinc-400">
                      My Files (
                      {filteredMyFiles.filter((f) => f.assignedTo).length})
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredMyFiles
                        .filter((f) => f.assignedTo)
                        .map((file) => renderFileCard(file))}
                    </div>
                  </div>
                )}

                {/* Family Documents (unassigned) */}
                {filteredMyFiles.filter((f) => !f.assignedTo).length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-zinc-400">
                      Family Documents (
                      {filteredMyFiles.filter((f) => !f.assignedTo).length})
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredMyFiles
                        .filter((f) => !f.assignedTo)
                        .map((file) => renderFileCard(file))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Shared tab */}
        {activeTab === "shared" && (
          <>
            {sharedFiles === undefined || sharedFolders === undefined ? (
              <GroupedFilesSkeleton />
            ) : filteredSharedFolders.length === 0 &&
              filteredSharedFiles.length === 0 ? (
              <EmptyState
                icon={<FileIcon className="h-8 w-8" />}
                title={searchQuery ? "No items found" : "No shared files"}
                description={
                  searchQuery
                    ? "Try a different search term"
                    : "Files shared by family members will appear here"
                }
              />
            ) : (
              <div className="space-y-8">
                {/* Shared folders first */}
                {filteredSharedFolders.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-zinc-400">
                      Shared Folders ({filteredSharedFolders.length})
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredSharedFolders.map((folder) => (
                        <FolderCard
                          key={folder._id}
                          id={folder._id}
                          name={folder.name}
                          sharedWithFamily={folder.sharedWithFamily}
                          sharedWith={folder.sharedWith ?? []}
                          assignedTo={folder.assignedTo}
                          assigneeName={folder.assigneeName}
                          itemCount={folder.itemCount}
                          isOwner={false}
                          familyMembers={members}
                          parentFolderName={searchQuery && folder.parentFolderId ? folderNameMap.get(folder.parentFolderId) : undefined}
                          onClick={() => navigateToFolder(folder._id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared files grouped by assignee */}
                {groupedSharedFiles &&
                  Object.entries(groupedSharedFiles).map(
                    ([assigneeId, group]) => (
                      <div key={assigneeId}>
                        <h3 className="mb-4 text-sm font-medium text-zinc-400">
                          {group.assigneeName === "Family Documents"
                            ? "Family Documents"
                            : `${group.assigneeName}'s Files`}{" "}
                          ({group.files.length})
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {group.files.map((file) => (
                            <FileCard
                              key={file._id}
                              id={file._id}
                              name={file.name}
                              url={file.url}
                              type={file.type}
                              size={file.size}
                              createdAt={file.createdAt}
                              sharedWithFamily={file.sharedWithFamily}
                              sharedWith={file.sharedWith ?? []}
                              tags={file.tags ?? []}
                              assignedTo={file.assignedTo}
                              assigneeName={file.assigneeName}
                              isOwner={false}
                              uploaderName={file.uploaderName}
                              familyMembers={members}
                              folderName={searchQuery && file.folderId ? folderNameMap.get(file.folderId) : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating action button - only for owner */}
      {isOwner && (
        <div className={cn(
          "fixed right-6 z-20 md:right-8",
          selectionMode ? "bottom-20 md:bottom-24" : "bottom-6 md:bottom-8"
        )}>
          {/* FAB Menu */}
          {showFabMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFabMenu(false)}
              />
              <div className="absolute bottom-16 right-0 z-20 mb-2 flex flex-col items-end gap-2">
                <button
                  onClick={() => {
                    setShowFabMenu(false);
                    setShowCreateFolder(true);
                  }}
                  className="flex items-center gap-3 rounded-full bg-zinc-800 py-2 pl-4 pr-3 text-sm font-medium text-zinc-200 shadow-lg transition-colors hover:bg-zinc-700"
                >
                  <span>New folder</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
                    <FolderIcon className="h-5 w-5" />
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowFabMenu(false);
                    setShowUploader(true);
                  }}
                  className="flex items-center gap-3 rounded-full bg-zinc-800 py-2 pl-4 pr-3 text-sm font-medium text-zinc-200 shadow-lg transition-colors hover:bg-zinc-700"
                >
                  <span>Upload files</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-white">
                    <UploadIcon className="h-5 w-5" />
                  </span>
                </button>
              </div>
            </>
          )}
          {/* Main FAB */}
          <button
            onClick={() => setShowFabMenu(!showFabMenu)}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-all",
              "hover:bg-violet-500 active:bg-violet-700",
              showFabMenu && "rotate-45 bg-zinc-700 hover:bg-zinc-600"
            )}
            aria-label="Add new"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Upload modal */}
      <Modal
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        title="Upload files"
      >
        <FileUploader
          onClose={() => setShowUploader(false)}
          familyMembers={members}
          currentFolderId={currentFolderId}
          currentFolderAssignee={currentFolderAssignee}
          folders={allFolders ?? []}
        />
      </Modal>

      {/* Create folder modal */}
      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        parentFolderId={currentFolderId}
        familyMembers={members}
      />

      {/* Move modal */}
      {moveTarget && (
        <MoveModal
          isOpen={!!moveTarget}
          onClose={() => setMoveTarget(null)}
          itemType={moveTarget.type}
          itemId={moveTarget.id}
          itemName={moveTarget.name}
          currentFolderId={moveTarget.currentFolderId}
        />
      )}

      {/* Settings modal */}
      <FamilySettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        family={family}
        members={members}
        currentUserRole={currentUser?.role}
      />

      {/* Bulk action bar */}
      {isOwner && (
        <BulkActionBar
          selectedIds={selectedFiles}
          onClearSelection={clearSelection}
          familyMembers={members}
        />
      )}
    </div>
  );
}
