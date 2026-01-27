"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Modal } from "./ui/modal";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

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
  const [assignedTo, setAssignedTo] = useState<Id<"users"> | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = useMutation(api.folders.createFolder);

  // All members except owner can be assigned
  const assignableMembers = familyMembers.filter((m) => m.role !== "owner");

  const handleCreate = async () => {
    if (!user || !name.trim()) return;

    setIsCreating(true);
    try {
      await createFolder({
        name: name.trim(),
        parentFolderId,
        assignedTo,
        clerkId: user.id,
      });
      setName("");
      setAssignedTo(undefined);
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName("");
    setAssignedTo(undefined);
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
            <select
              value={assignedTo ?? ""}
              onChange={(e) =>
                setAssignedTo(
                  e.target.value ? (e.target.value as Id<"users">) : undefined
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="">Unassigned (family folder)</option>
              {assignableMembers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
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
