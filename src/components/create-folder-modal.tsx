"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Modal } from "./ui/modal";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";

interface FamilyMember {
  _id: Id<"users">;
  name: string;
  email: string;
  role?: "owner" | "member";
}

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentFolderId?: Id<"folders">;
  familyMembers: FamilyMember[];
}

export function CreateFolderModal({
  isOpen,
  onClose,
  parentFolderId,
  familyMembers,
}: CreateFolderModalProps) {
  const { user } = useUser();
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState<Id<"users">[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = useMutation(api.folders.createFolder);

  // All family members (including owner) can be assigned
  const assignableMembers = familyMembers;

  const toggleAssignee = (memberId: Id<"users">) => {
    setAssignedTo((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreate = async () => {
    if (!user || !name.trim()) return;

    setIsCreating(true);
    try {
      await createFolder({
        name: name.trim(),
        parentFolderId,
        assignedTo: assignedTo.length > 0 ? assignedTo : undefined,
        clerkId: user.id,
      });
      setName("");
      setAssignedTo([]);
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName("");
    setAssignedTo([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create folder">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Folder name
          </label>
          <Input
            placeholder="e.g., Tax Documents"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) void handleCreate();
            }}
          />
        </div>

        {assignableMembers.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
              Assign to (optional)
            </label>
            <p className="mb-2 text-xs text-zinc-500">
              Select one or more people, or leave empty for a family folder
            </p>
            <div className="space-y-2">
              {assignableMembers.map((member) => {
                const isSelected = assignedTo.includes(member._id);
                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => toggleAssignee(member._id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      isSelected
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-zinc-700 hover:bg-zinc-800"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border",
                        isSelected
                          ? "border-violet-500 bg-violet-500"
                          : "border-zinc-600 bg-zinc-800"
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-sm text-zinc-300">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-200">
                        {member.name}
                        {member.role === "owner" ? " (Me)" : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {assignedTo.length === 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                This will be a family folder visible to everyone
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={isCreating}
            disabled={!name.trim()}
            className="flex-1"
          >
            Create folder
          </Button>
        </div>
      </div>
    </Modal>
  );
}
