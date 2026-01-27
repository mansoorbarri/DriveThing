"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Header } from "~/components/header";
import { FileCard } from "~/components/file-card";
import { FileUploader } from "~/components/file-uploader";
import { FamilySetup } from "~/components/family-setup";
import { FamilySettings } from "~/components/family-settings";
import { EmptyState } from "~/components/ui/empty-state";
import { Modal } from "~/components/ui/modal";
import {
  FileGridSkeleton,
  DashboardSkeleton,
  GroupedFilesSkeleton,
} from "~/components/ui/skeleton";
import { PlusIcon, FileIcon, UploadIcon } from "~/components/icons";
import { cn } from "~/lib/utils";

type Tab = "my-files" | "shared";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>("my-files");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploader, setShowUploader] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Fetch files
  const myFiles = useQuery(
    api.files.getMyFiles,
    user ? { clerkId: user.id } : "skip"
  );

  const sharedFiles = useQuery(
    api.files.getSharedFiles,
    user ? { clerkId: user.id } : "skip"
  );

  // Filter files by search
  const filteredMyFiles = useMemo(() => {
    if (!myFiles) return [];
    if (!searchQuery) return myFiles;
    const term = searchQuery.toLowerCase();
    return myFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.tags?.some((tag) => tag.toLowerCase().includes(term))
    );
  }, [myFiles, searchQuery]);

  // Group files by assignee for owner view
  const groupedFiles = useMemo(() => {
    if (!filteredMyFiles || !userWithFamily) return null;

    const currentUserRole = userWithFamily.user?.role;
    if (currentUserRole !== "owner") return null;

    const familyMembers = userWithFamily.members;
    const groups: Record<string, typeof filteredMyFiles> = {
      unassigned: [],
    };

    // Create groups for each member
    familyMembers.forEach((m) => {
      if (m.role !== "owner") {
        groups[m._id] = [];
      }
    });

    // Sort files into groups
    filteredMyFiles.forEach((file) => {
      if (file.assignedTo) {
        const targetGroup = groups[file.assignedTo];
        if (targetGroup) {
          targetGroup.push(file);
        } else {
          // Assigned to someone not in members list (edge case)
          groups.unassigned?.push(file);
        }
      } else {
        groups.unassigned?.push(file);
      }
    });

    return groups;
  }, [filteredMyFiles, userWithFamily]);

  const filteredSharedFiles = useMemo(() => {
    if (!sharedFiles) return [];
    if (!searchQuery) return sharedFiles;
    const term = searchQuery.toLowerCase();
    return sharedFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.tags?.some((tag) => tag.toLowerCase().includes(term))
    );
  }, [sharedFiles, searchQuery]);

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
            onClick={() => setActiveTab("my-files")}
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
            onClick={() => setActiveTab("shared")}
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

        {/* File grid */}
        {activeTab === "my-files" && (
          <>
            {myFiles === undefined ? (
              isOwner ? (
                <GroupedFilesSkeleton />
              ) : (
                <FileGridSkeleton />
              )
            ) : filteredMyFiles.length === 0 ? (
              <EmptyState
                icon={<FileIcon className="h-8 w-8" />}
                title={searchQuery ? "No files found" : "No files yet"}
                description={
                  searchQuery
                    ? "Try a different search term"
                    : isOwner
                      ? "Upload your first file to get started"
                      : "Files assigned to you will appear here"
                }
                action={
                  !searchQuery &&
                  isOwner && (
                    <button
                      onClick={() => setShowUploader(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
                    >
                      <UploadIcon className="h-5 w-5" />
                      Upload files
                    </button>
                  )
                }
              />
            ) : isOwner && groupedFiles ? (
              // Grouped view for owners
              <div className="space-y-8">
                {/* Unassigned files */}
                {(groupedFiles.unassigned?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-zinc-400">
                      Family Documents ({groupedFiles.unassigned?.length ?? 0})
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {groupedFiles.unassigned?.map((file) => (
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
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* Files grouped by member */}
                {members
                  .filter((m) => m.role !== "owner")
                  .map((member) => {
                    const memberFiles = groupedFiles[member._id] ?? [];
                    if (memberFiles.length === 0) return null;
                    return (
                      <div key={member._id}>
                        <h3 className="mb-4 text-sm font-medium text-zinc-400">
                          {member.name}&apos;s Files ({memberFiles.length})
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {memberFiles.map((file) => (
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
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              // Simple grid for members
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMyFiles.map((file) => (
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
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "shared" && (
          <>
            {sharedFiles === undefined ? (
              <FileGridSkeleton />
            ) : filteredSharedFiles.length === 0 ? (
              <EmptyState
                icon={<FileIcon className="h-8 w-8" />}
                title={searchQuery ? "No files found" : "No shared files"}
                description={
                  searchQuery
                    ? "Try a different search term"
                    : "Files shared by family members will appear here"
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSharedFiles.map((file) => (
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
        />
      </Modal>

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
