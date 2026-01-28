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
import { EmptyState } from "~/components/ui/empty-state";
import { Modal } from "~/components/ui/modal";
import {
  FileGridSkeleton,
  DashboardSkeleton,
  GroupedFilesSkeleton,
} from "~/components/ui/skeleton";
import { PlusIcon, FileIcon, UploadIcon, FolderIcon } from "~/components/icons";
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

  // Fetch folders
  const myFolders = useQuery(
    api.folders.getMyFolders,
    user ? { clerkId: user.id, parentFolderId: currentFolderId } : "skip"
  );

  const sharedFolders = useQuery(
    api.folders.getSharedFolders,
    user ? { clerkId: user.id, parentFolderId: currentFolderId } : "skip"
  );

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

  // Fetch files with folder filter
  const myFiles = useQuery(
    api.files.getMyFiles,
    user
      ? {
          clerkId: user.id,
          folderId: currentFolderId,
          rootOnly: !currentFolderId,
        }
      : "skip"
  );

  const sharedFiles = useQuery(
    api.files.getSharedFiles,
    user
      ? {
          clerkId: user.id,
          folderId: currentFolderId,
          rootOnly: !currentFolderId,
        }
      : "skip"
  );

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

        {/* New Folder button for owner */}
        {isOwner && activeTab === "my-files" && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setShowCreateFolder(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <FolderIcon className="h-4 w-4" />
              New folder
            </button>
          </div>
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
                  return (
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-violet-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-xs">
                          {ownerMember?.name[0]?.toUpperCase()}
                        </span>
                        {ownerMember?.name}&apos;s Items ({ownerFolders.length + ownerFiles.length})
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {ownerFolders.map(renderFolderCard)}
                        {ownerFiles.map((file) => renderFileCard(file))}
                      </div>
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
                    return (
                      <div key={member._id}>
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-300">
                            {member.name[0]?.toUpperCase()}
                          </span>
                          {member.name}&apos;s Items ({memberFolders.length + memberFiles.length})
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {memberFolders.map(renderFolderCard)}
                          {memberFiles.map((file) => renderFileCard(file))}
                        </div>
                      </div>
                    );
                  })}

                {/* Family items (unassigned folders and files) */}
                {(() => {
                  const unassignedFolders = filteredMyFolders.filter((f) => !f.assignedTo);
                  const unassignedFiles = groupedFiles.unassigned ?? [];
                  if (unassignedFolders.length === 0 && unassignedFiles.length === 0) return null;
                  return (
                    <div>
                      <h3 className="mb-4 text-sm font-medium text-zinc-400">
                        Family Items ({unassignedFolders.length + unassignedFiles.length})
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {unassignedFolders.map(renderFolderCard)}
                        {unassignedFiles.map((file) => renderFileCard(file))}
                      </div>
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

      {/* Floating upload button - only for owner */}
      {isOwner && (
        <button
          onClick={() => setShowUploader(true)}
          className={cn(
            "fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg",
            "hover:bg-violet-500 active:bg-violet-700 transition-colors",
            "md:bottom-8 md:right-8"
          )}
          aria-label="Upload files"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
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
    </div>
  );
}
