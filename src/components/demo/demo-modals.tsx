"use client";

import { useMemo, useState } from "react";
import { Modal } from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  FamilyIcon,
  FileIcon,
  FolderIcon,
  HomeIcon,
  TrashIcon,
} from "~/components/icons";
import { cn } from "~/lib/utils";
import type { DemoFolder, DemoMember } from "./demo-data";
import { useDemo } from "./demo-store";

// ---------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  kind: "file" | "folder";
  currentAssignee?: string | null; // null = mixed / bulk (no highlight)
  onAssign: (memberId?: string) => void;
}

export function AssignModal({
  isOpen,
  onClose,
  title,
  description,
  kind,
  currentAssignee,
  onAssign,
}: AssignModalProps) {
  const { state } = useDemo();
  const option = (selected: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
      selected
        ? "border-violet-500 bg-violet-500/10 text-zinc-100"
        : "border-zinc-700 text-zinc-300 hover:bg-zinc-800",
    );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-zinc-400">{description}</p>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        <button
          onClick={() => onAssign(undefined)}
          className={option(currentAssignee === undefined)}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-400">
            {kind === "file" ? (
              <FileIcon className="h-4 w-4" />
            ) : (
              <FolderIcon className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="font-medium">Unassigned</p>
            <p className="text-xs text-zinc-500">
              {kind === "file" ? "Family documents" : "Family folder"}
            </p>
          </div>
        </button>
        {state.members.map((member) => (
          <button
            key={member.id}
            onClick={() => onAssign(member.id)}
            className={option(currentAssignee === member.id)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
              {member.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-medium">
                {member.name}
                {member.role === "owner" ? " (Me)" : ""}
              </p>
              <p className="truncate text-xs text-zinc-500">{member.title}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  kind: "file" | "folder";
  itemName: string;
  sharedWithFamily: boolean;
  sharedWith: string[];
  onSave: (family: boolean, withIds: string[]) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  kind,
  itemName,
  sharedWithFamily,
  sharedWith,
  onSave,
}: ShareModalProps) {
  const { state, viewer } = useDemo();
  const [shareWithAll, setShareWithAll] = useState(sharedWithFamily);
  const [selected, setSelected] = useState<string[]>(sharedWith);

  const otherMembers = state.members
    .filter((m) => m.id !== viewer.id)
    .sort((a, b) =>
      a.role === "owner"
        ? -1
        : b.role === "owner"
          ? 1
          : a.name.localeCompare(b.name),
    );

  const hasChanges =
    shareWithAll !== sharedWithFamily ||
    JSON.stringify([...selected].sort()) !==
      JSON.stringify([...sharedWith].sort());
  const isShared = shareWithAll || selected.length > 0;

  const handleClose = () => {
    setShareWithAll(sharedWithFamily);
    setSelected(sharedWith);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Share ${kind}`}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">
          Choose who can see &ldquo;{itemName}&rdquo;
          {kind === "folder" ? " and its contents" : ""}.
        </p>
        <button
          onClick={() => {
            setShareWithAll(!shareWithAll);
            if (!shareWithAll) setSelected([]);
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
            shareWithAll
              ? "border-violet-500 bg-violet-500/10"
              : "border-zinc-700 hover:bg-zinc-800",
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
              shareWithAll
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400",
            )}
          >
            All
          </div>
          <div className="flex-1">
            <p className="font-medium text-zinc-100">Everyone in family</p>
            <p className="text-sm text-zinc-500">
              All {state.members.length} members can see this {kind}
            </p>
          </div>
          {shareWithAll && <CheckIcon className="h-5 w-5 text-violet-400" />}
        </button>

        {!shareWithAll && otherMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Or share with specific people
            </p>
            {otherMembers.map((member) => {
              const isSelected = selected.includes(member.id);
              return (
                <button
                  key={member.id}
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(member.id)
                        ? prev.filter((id) => id !== member.id)
                        : [...prev, member.id],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-zinc-700 hover:bg-zinc-800",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium",
                      isSelected
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400",
                    )}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">
                      {member.name}
                    </p>
                    <p className="truncate text-sm text-zinc-500">
                      {member.title}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckIcon className="h-5 w-5 text-violet-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!isShared && (
          <p className="rounded-lg bg-zinc-800/50 p-3 text-center text-sm text-zinc-500">
            This {kind} is private - only you can see it
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(shareWithAll, shareWithAll ? [] : selected);
              onClose();
            }}
            disabled={!hasChanges}
            className="flex-1"
          >
            {isShared ? "Save" : "Keep private"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

export function RenameModal({
  isOpen,
  onClose,
  title,
  initialName,
  onRename,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialName: string;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const canSave = name.trim() && name.trim() !== initialName;
  const save = () => {
    if (!canSave) return;
    onRename(name.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a new name"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave} className="flex-1">
            Rename
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Confirm delete
// ---------------------------------------------------------------------------

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="mb-6 text-zinc-400">{children}</div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="flex-1"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Folder picker (move)
// ---------------------------------------------------------------------------

interface FolderNode extends DemoFolder {
  children: FolderNode[];
}

export function FolderPickerModal({
  isOpen,
  onClose,
  title,
  description,
  currentFolderId,
  movingFolderIds = [],
  onMove,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  currentFolderId?: string | null; // null = mixed (bulk)
  movingFolderIds?: string[];
  onMove: (folderId?: string) => void;
}) {
  const { state } = useDemo();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    currentFolderId ?? undefined,
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const groups = useMemo(() => {
    const nodes = new Map<string, FolderNode>(
      state.folders.map((f) => [f.id, { ...f, children: [] }]),
    );
    const roots: FolderNode[] = [];
    nodes.forEach((node) => {
      const parent = node.parentFolderId
        ? nodes.get(node.parentFolderId)
        : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });
    const sort = (list: FolderNode[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
      list.forEach((n) => sort(n.children));
    };
    sort(roots);
    const owner = state.members.find((m) => m.role === "owner");
    const ordered: DemoMember[] = [
      ...(owner ? [owner] : []),
      ...state.members
        .filter((m) => m.role !== "owner")
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
    const result = ordered
      .map((m) => ({
        id: m.id,
        label: `${m.name}'s Folders`,
        member: m,
        folders: roots.filter((f) => f.assignedTo === m.id),
      }))
      .filter((g) => g.folders.length > 0);
    const unassigned = roots.filter((f) => !f.assignedTo);
    if (unassigned.length)
      result.push({
        id: "unassigned",
        label: "Family Folders",
        member: undefined as unknown as DemoMember,
        folders: unassigned,
      });
    return result;
  }, [state.folders, state.members]);

  const isInvalid = (folderId: string): boolean => {
    let current = state.folders.find((f) => f.id === folderId);
    while (current) {
      if (movingFolderIds.includes(current.id)) return true;
      const parentId: string | undefined = current.parentFolderId;
      current = parentId
        ? state.folders.find((f) => f.id === parentId)
        : undefined;
    }
    return false;
  };

  const renderNode = (node: FolderNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const disabled = isInvalid(node.id);
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
            disabled
              ? "cursor-not-allowed opacity-50"
              : selectedId === node.id
                ? "bg-violet-500/20 text-zinc-100"
                : "cursor-pointer text-zinc-300 hover:bg-zinc-800",
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => !disabled && setSelectedId(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                });
              }}
              className="rounded p-0.5 hover:bg-zinc-700"
            >
              <ChevronRightIcon
                className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
            </button>
          ) : (
            <div className="w-5" />
          )}
          <FolderIcon className="h-4 w-4 text-amber-400" />
          <span className="truncate">{node.name}</span>
          {currentFolderId === node.id && (
            <span className="ml-auto text-xs text-zinc-500">(current)</span>
          )}
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-zinc-400">{description}</p>
      <div className="mb-4 max-h-72 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/50">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
            selectedId === undefined
              ? "bg-violet-500/20 text-zinc-100"
              : "cursor-pointer text-zinc-300 hover:bg-zinc-800",
          )}
          onClick={() => setSelectedId(undefined)}
        >
          <div className="w-5" />
          <HomeIcon className="h-4 w-4 text-zinc-400" />
          <span>Root (no folder)</span>
          {currentFolderId === undefined && (
            <span className="ml-auto text-xs text-zinc-500">(current)</span>
          )}
        </div>
        {groups.map((group) => {
          const open = !collapsedGroups.has(group.id);
          const isOwnerGroup = group.member?.role === "owner";
          return (
            <div
              key={group.id}
              className="border-b border-zinc-700/50 last:border-b-0"
            >
              <button
                onClick={() =>
                  setCollapsedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.id)) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })
                }
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-zinc-800/50",
                  isOwnerGroup ? "text-violet-400" : "text-zinc-400",
                )}
              >
                <ChevronRightIcon
                  className={cn(
                    "h-4 w-4 transition-transform",
                    open && "rotate-90",
                  )}
                />
                {group.member ? (
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isOwnerGroup ? "bg-violet-500/20" : "bg-zinc-700",
                    )}
                  >
                    {group.member.name[0]?.toUpperCase()}
                  </span>
                ) : (
                  <FamilyIcon className="h-4 w-4" />
                )}
                <span>{group.label}</span>
                <span className="ml-auto text-xs text-zinc-500">
                  ({group.folders.length})
                </span>
              </button>
              {open && (
                <div className="pb-1">
                  {group.folders.map((n) => renderNode(n, 0))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => {
            onMove(selectedId);
            onClose();
          }}
          disabled={selectedId === currentFolderId}
          className="flex-1"
        >
          Move here
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create folder
// ---------------------------------------------------------------------------

export function CreateFolderModal({
  isOpen,
  onClose,
  parentFolderId,
  defaultAssignee,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  parentFolderId?: string;
  defaultAssignee?: string;
  onCreated: (name: string) => void;
}) {
  const { state, createFolder } = useDemo();
  const [name, setName] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | undefined>(
    defaultAssignee,
  );

  const handleClose = () => {
    setName("");
    onClose();
  };
  const create = () => {
    if (!name.trim()) return;
    createFolder(name.trim(), parentFolderId, assignedTo);
    onCreated(name.trim());
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create folder">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Folder name
          </label>
          <Input
            placeholder="e.g., Year-End 2027"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-400">
            Assign to (optional)
          </label>
          <select
            value={assignedTo ?? ""}
            onChange={(e) => setAssignedTo(e.target.value || undefined)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
          >
            <option value="">Unassigned (family folder)</option>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.role === "owner" ? " (Me)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim()} className="flex-1">
            Create folder
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { state, viewer, regenerateInviteCode, removeMember } = useDemo();
  const [copied, setCopied] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const isOwner = viewer.role === "owner";

  const copy = async () => {
    await navigator.clipboard
      ?.writeText(state.workspace.inviteCode)
      .catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Family Settings">
        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
              Family name
            </label>
            <p className="text-lg font-semibold text-zinc-100">
              {state.workspace.name}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
              Invite code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-zinc-800 px-4 py-3 font-mono text-lg tracking-widest text-zinc-100">
                {state.workspace.inviteCode}
              </div>
              <button
                onClick={copy}
                className="rounded-lg p-3 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Copy invite code"
              >
                {copied ? (
                  <CheckIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <CopyIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            {isOwner && (
              <button
                onClick={regenerateInviteCode}
                className="mt-2 text-sm text-violet-400 hover:text-violet-300"
              >
                Generate new code
              </button>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Share this code with new clients or staff so they can join your
              workspace.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">
              Members ({state.members.length})
            </label>
            <div className="space-y-2">
              {state.members.map((member) => {
                const isSelf = member.id === viewer.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-zinc-300">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-100">
                        {member.name}
                        {isSelf && (
                          <span className="ml-1 text-sm text-zinc-500">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-zinc-500">
                        {member.role === "owner" ? "Owner" : "Member"} ·{" "}
                        {member.title}
                      </p>
                    </div>
                    {isOwner && !isSelf && member.role !== "owner" && (
                      <button
                        onClick={() => removeMember(member.id)}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
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
          {!isOwner && (
            <div className="border-t border-zinc-800 pt-4">
              <Button
                variant="danger"
                onClick={() => setShowLeave(true)}
                className="w-full"
              >
                Leave family
              </Button>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmModal
        isOpen={showLeave}
        onClose={() => setShowLeave(false)}
        title="Leave family?"
        confirmLabel="Got it"
        onConfirm={() => undefined}
      >
        In the real app, {viewer.name} would leave &ldquo;{state.workspace.name}
        &rdquo; here. Leaving is disabled in the demo.
      </ConfirmModal>
    </>
  );
}
