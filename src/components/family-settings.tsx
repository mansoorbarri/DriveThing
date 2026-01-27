"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { CopyIcon, CheckIcon, TrashIcon, FamilyIcon } from "./icons";
import { cn } from "~/lib/utils";

interface FamilySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  family: Doc<"families"> | null;
  members: Doc<"users">[];
  currentUserRole?: "owner" | "member";
}

export function FamilySettings({
  isOpen,
  onClose,
  family,
  members,
  currentUserRole,
}: FamilySettingsProps) {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [removingMember, setRemovingMember] = useState<Id<"users"> | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const regenerateCode = useMutation(api.families.regenerateInviteCode);
  const removeMember = useMutation(api.families.removeMember);
  const leaveFamily = useMutation(api.families.leaveFamily);

  const copyInviteCode = async () => {
    if (!family) return;
    await navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!user) return;
    setRegenerating(true);
    try {
      await regenerateCode({ clerkId: user.id });
    } finally {
      setRegenerating(false);
    }
  };

  const handleRemoveMember = async (memberId: Id<"users">) => {
    if (!user) return;
    setRemovingMember(memberId);
    try {
      await removeMember({ clerkId: user.id, memberUserId: memberId });
    } finally {
      setRemovingMember(null);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    setLeaving(true);
    try {
      await leaveFamily({ clerkId: user.id });
      onClose();
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  if (!family) return null;

  const isOwner = currentUserRole === "owner";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Family Settings">
        <div className="space-y-6">
          {/* Family name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Family name
            </label>
            <p className="text-lg font-semibold text-gray-900">{family.name}</p>
          </div>

          {/* Invite code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Invite code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-mono text-lg tracking-widest text-gray-900">
                {family.inviteCode}
              </div>
              <button
                onClick={copyInviteCode}
                className="rounded-lg p-3 text-gray-500 hover:bg-gray-100"
                aria-label="Copy invite code"
              >
                {copied ? (
                  <CheckIcon className="h-5 w-5 text-green-600" />
                ) : (
                  <CopyIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            {isOwner && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {regenerating ? "Generating..." : "Generate new code"}
              </button>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Share this code with family members so they can join.
            </p>
          </div>

          {/* Members list */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Members ({members.length})
            </label>
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = member.clerkId === user?.id;
                const memberIsOwner = member.role === "owner";

                return (
                  <div
                    key={member._id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
                  >
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                        {member.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {member.name}
                        {isSelf && (
                          <span className="ml-1 text-sm text-gray-500">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-gray-500">
                        {memberIsOwner ? "Owner" : "Member"}
                      </p>
                    </div>
                    {isOwner && !isSelf && !memberIsOwner && (
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        disabled={removingMember === member._id}
                        className={cn(
                          "rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600",
                          removingMember === member._id && "opacity-50"
                        )}
                        aria-label="Remove member"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave family (for non-owners) */}
          {!isOwner && (
            <div className="border-t border-gray-200 pt-4">
              <Button
                variant="danger"
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full"
              >
                Leave family
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Leave confirmation */}
      <Modal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="Leave family?"
      >
        <p className="mb-6 text-gray-600">
          Are you sure you want to leave &ldquo;{family.name}&rdquo;? Your files
          will be deleted.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowLeaveConfirm(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleLeave}
            loading={leaving}
            className="flex-1"
          >
            Leave
          </Button>
        </div>
      </Modal>
    </>
  );
}
