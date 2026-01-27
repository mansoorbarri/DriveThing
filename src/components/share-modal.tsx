"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { CheckIcon } from "./icons";
import { cn } from "~/lib/utils";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  email: string;
  imageUrl?: string;
  role?: "owner" | "member";
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: Id<"files">;
  fileName: string;
  sharedWithFamily: boolean;
  sharedWith: Id<"users">[];
  familyMembers: FamilyMember[];
}

export function ShareModal({
  isOpen,
  onClose,
  fileId,
  fileName,
  sharedWithFamily,
  sharedWith,
  familyMembers,
}: ShareModalProps) {
  const { user } = useUser();
  const [shareWithAll, setShareWithAll] = useState(sharedWithFamily);
  const [selectedMembers, setSelectedMembers] = useState<Id<"users">[]>(
    sharedWith ?? []
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateSharing = useMutation(api.files.updateFileSharing);

  // Filter out the current user from the list (match by email)
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress;
  const otherMembers = familyMembers.filter(
    (m) => m.email !== currentUserEmail
  );

  const handleToggleMember = (memberId: Id<"users">) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleToggleAll = () => {
    if (shareWithAll) {
      setShareWithAll(false);
    } else {
      setShareWithAll(true);
      setSelectedMembers([]);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await updateSharing({
        fileId,
        clerkId: user.id,
        shareWithFamily: shareWithAll,
        sharedWith: shareWithAll ? [] : selectedMembers,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    shareWithAll !== sharedWithFamily ||
    JSON.stringify([...selectedMembers].sort()) !==
      JSON.stringify([...(sharedWith ?? [])].sort());

  const isShared = shareWithAll || selectedMembers.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share file">
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">
          Choose who can see &ldquo;{fileName}&rdquo;
        </p>

        {/* Share with everyone option */}
        <button
          onClick={handleToggleAll}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
            shareWithAll
              ? "border-blue-500 bg-blue-500/10"
              : "border-zinc-700 hover:bg-zinc-800"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
              shareWithAll
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400"
            )}
          >
            All
          </div>
          <div className="flex-1">
            <p className="font-medium text-zinc-100">Everyone in family</p>
            <p className="text-sm text-zinc-500">
              All {familyMembers.length} members can see this file
            </p>
          </div>
          {shareWithAll && <CheckIcon className="h-5 w-5 text-blue-400" />}
        </button>

        {/* Individual members */}
        {!shareWithAll && otherMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Or share with specific people
            </p>
            {otherMembers.map((member) => {
              const isSelected = selectedMembers.includes(member._id);
              return (
                <button
                  key={member._id}
                  onClick={() => handleToggleMember(member._id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 hover:bg-zinc-800"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-100 truncate">
                      {member.name}
                    </p>
                    <p className="text-sm text-zinc-500 truncate">
                      {member.email}
                    </p>
                  </div>
                  {isSelected && <CheckIcon className="h-5 w-5 text-blue-400" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Not shared indicator */}
        {!isShared && (
          <p className="rounded-lg bg-zinc-800/50 p-3 text-center text-sm text-zinc-500">
            This file is private - only you can see it
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            loading={isSaving}
            className="flex-1"
          >
            {isShared ? "Save" : "Keep private"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
