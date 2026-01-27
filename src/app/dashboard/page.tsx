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
import { FileGridSkeleton } from "~/components/ui/skeleton";
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
    return myFiles.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [myFiles, searchQuery]);

  const filteredSharedFiles = useMemo(() => {
    if (!sharedFiles) return [];
    if (!searchQuery) return sharedFiles;
    return sharedFiles.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sharedFiles, searchQuery]);

  // Loading state
  if (!isLoaded || userWithFamily === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Not in a family yet - show setup
  if (!userWithFamily?.family) {
    return (
      <main className="min-h-screen bg-gray-50">
        <FamilySetup />
      </main>
    );
  }

  const { family, members } = userWithFamily;
  const currentUser = userWithFamily.user;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        familyName={family.name}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSettingsClick={() => setShowSettings(true)}
      />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab("my-files")}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "my-files"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            My Files
            {myFiles && myFiles.length > 0 && (
              <span className="ml-1.5 text-gray-400">({myFiles.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("shared")}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "shared"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Shared with me
            {sharedFiles && sharedFiles.length > 0 && (
              <span className="ml-1.5 text-gray-400">
                ({sharedFiles.length})
              </span>
            )}
          </button>
        </div>

        {/* File grid */}
        {activeTab === "my-files" && (
          <>
            {myFiles === undefined ? (
              <FileGridSkeleton />
            ) : filteredMyFiles.length === 0 ? (
              <EmptyState
                icon={<FileIcon className="h-8 w-8" />}
                title={searchQuery ? "No files found" : "No files yet"}
                description={
                  searchQuery
                    ? "Try a different search term"
                    : "Upload your first file to get started"
                }
                action={
                  !searchQuery && (
                    <button
                      onClick={() => setShowUploader(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                    >
                      <UploadIcon className="h-5 w-5" />
                      Upload files
                    </button>
                  )
                }
              />
            ) : (
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
                    isOwner={true}
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
                    isOwner={false}
                    uploaderName={file.uploaderName}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating upload button */}
      <button
        onClick={() => setShowUploader(true)}
        className={cn(
          "fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg",
          "hover:bg-blue-700 active:bg-blue-800 transition-colors",
          "md:bottom-8 md:right-8"
        )}
        aria-label="Upload files"
      >
        <PlusIcon className="h-6 w-6" />
      </button>

      {/* Upload modal */}
      <Modal
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        title="Upload files"
      >
        <FileUploader onClose={() => setShowUploader(false)} />
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
