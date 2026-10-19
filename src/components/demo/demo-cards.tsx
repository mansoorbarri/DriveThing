"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DownloadIcon,
  EditIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  ImageIcon,
  MoreIcon,
  MoveIcon,
  PdfIcon,
  ShareIcon,
  SpreadsheetIcon,
  TrashIcon,
  UserIcon,
} from "~/components/icons";
import {
  FilePreviewModal,
  warmFilePreview,
} from "~/components/file-preview-modal";
import { useToast } from "~/components/ui/toast";
import {
  canPreviewFile,
  cn,
  downloadFile,
  formatDate,
  formatFileSize,
  getFileIcon,
  openFileInNewTab,
} from "~/lib/utils";
import { useDemo, type FileView, type FolderView } from "./demo-store";
import {
  AssignModal,
  ConfirmModal,
  FolderPickerModal,
  RenameModal,
  ShareModal,
} from "./demo-modals";

type ToggleSelect = (id: string, options?: { shiftKey?: boolean }) => void;

const menuItem =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600";

function SelectCheckbox({
  id,
  isSelected,
  selectionMode,
  onToggleSelect,
}: {
  id: string;
  isSelected: boolean;
  selectionMode: boolean;
  onToggleSelect: ToggleSelect;
}) {
  return (
    <label
      className={cn(
        "absolute top-3 left-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-all",
        isSelected
          ? "border-violet-500 bg-violet-500"
          : "border-zinc-600 bg-zinc-900/90 hover:border-violet-500 hover:bg-violet-500/20",
        isSelected || selectionMode
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={isSelected}
        readOnly
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(id, { shiftKey: e.shiftKey });
        }}
        className="sr-only"
      />
      {isSelected && (
        <svg
          className="h-4 w-4 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </label>
  );
}

function SharingBadge({ family, count }: { family: boolean; count: number }) {
  if (!family && count === 0) return null;
  return (
    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400">
      <ShareIcon className="h-3 w-3" />
      {family
        ? "Shared with family"
        : `Shared with ${count} ${count === 1 ? "person" : "people"}`}
    </div>
  );
}

function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute top-3 right-3 rounded-lg bg-zinc-900/90 p-1.5 text-zinc-400 shadow-sm backdrop-blur-sm",
        "hover:bg-zinc-800 hover:text-zinc-200",
        "opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100",
        open && "opacity-100",
      )}
      aria-label="More options"
    >
      <MoreIcon className="h-5 w-5" />
    </button>
  );
}

function Dropdown({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="absolute top-12 right-3 z-20 w-52 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

const ICONS = {
  image: ImageIcon,
  pdf: PdfIcon,
  spreadsheet: SpreadsheetIcon,
  file: FileIcon,
};
const ICON_COLORS = {
  image: "text-purple-400 bg-purple-500/20",
  pdf: "text-red-400 bg-red-500/20",
  spreadsheet: "text-green-400 bg-green-500/20",
  file: "text-violet-400 bg-violet-500/20",
};

type Dialog =
  | "preview"
  | "share"
  | "assign"
  | "rename"
  | "move"
  | "delete"
  | null;

// ---------------------------------------------------------------------------

export function DemoFileCard({
  file,
  folderName,
  showUploader,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  file: FileView;
  folderName?: string;
  showUploader?: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: ToggleSelect;
}) {
  const { viewer, renameFile, assignFiles, shareFile, moveFiles, deleteFiles } =
    useDemo();
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const isOwner = viewer.role === "owner";
  const canShare = isOwner || file.assignedTo === viewer.id;
  const kind = getFileIcon(file.type, file.name);
  const Icon = ICONS[kind];
  const isImage = file.type.startsWith("image/");
  const hasPreview = canPreviewFile(file.type, file.name);
  const isShared = file.sharedWithFamily || file.sharedWith.length > 0;
  const absoluteUrl = () => new URL(file.url, window.location.origin).href;

  const open = (d: Dialog) => {
    setShowMenu(false);
    setDialog(d);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input[type='checkbox']"))
      return;
    if (selectionMode) {
      onToggleSelect(file.id, { shiftKey: e.shiftKey });
      return;
    }
    if (hasPreview) setDialog("preview");
    else openFileInNewTab(file.url);
  };

  const handleShareLink = async () => {
    setShowMenu(false);
    try {
      await navigator.clipboard.writeText(absoluteUrl());
      toast("Link copied to clipboard");
    } catch {
      toast("Couldn't copy link", "error");
    }
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        onMouseEnter={() => hasPreview && warmFilePreview(file)}
        className={cn(
          "group relative cursor-pointer rounded-xl border bg-zinc-900 transition-all",
          isSelected
            ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/50"
            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 active:bg-zinc-800",
        )}
      >
        <SelectCheckbox
          id={file.id}
          isSelected={isSelected}
          selectionMode={selectionMode}
          onToggleSelect={onToggleSelect}
        />

        {isImage ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-zinc-800">
            <Image
              src={file.url}
              alt={file.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="p-4 pb-0">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                ICON_COLORS[kind],
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>
        )}

        <div className="p-4">
          <h3
            className="mb-1 truncate font-medium text-zinc-100"
            title={file.name}
          >
            {file.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>{formatFileSize(file.size)}</span>
            <span className="text-zinc-700">|</span>
            <span>{formatDate(file.createdAt)}</span>
          </div>
          {folderName && (
            <p className="mt-1 truncate text-xs text-zinc-500">
              in {folderName}
            </p>
          )}
          {file.assigneeName && (
            <p className="mt-2 text-xs text-zinc-500">
              Assigned to {file.assigneeName}
            </p>
          )}
          {file.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {file.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
              {file.tags.length > 3 && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                  +{file.tags.length - 3}
                </span>
              )}
            </div>
          )}
          {isOwner && (
            <SharingBadge
              family={file.sharedWithFamily}
              count={file.sharedWith.length}
            />
          )}
          {showUploader && file.uploaderName && (
            <p className="mt-2 text-xs text-zinc-500">
              From {file.uploaderName}
            </p>
          )}
        </div>

        <MenuButton open={showMenu} onClick={() => setShowMenu(!showMenu)} />

        {showMenu && (
          <Dropdown onClose={() => setShowMenu(false)}>
            {hasPreview && (
              <button onClick={() => open("preview")} className={menuItem}>
                <EyeIcon className="h-4 w-4" />
                Preview
              </button>
            )}
            <button
              onClick={() => {
                setShowMenu(false);
                void downloadFile(file.name, file.url);
              }}
              className={menuItem}
            >
              <DownloadIcon className="h-4 w-4" />
              Download
            </button>
            <button onClick={handleShareLink} className={menuItem}>
              <ShareIcon className="h-4 w-4" />
              Share link
            </button>
            {canShare && (
              <button onClick={() => open("share")} className={menuItem}>
                <ShareIcon className="h-4 w-4" />
                {isShared ? "Manage sharing" : "Share with family"}
              </button>
            )}
            {isOwner && (
              <>
                <button onClick={() => open("rename")} className={menuItem}>
                  <EditIcon className="h-4 w-4" />
                  Rename
                </button>
                <button onClick={() => open("move")} className={menuItem}>
                  <MoveIcon className="h-4 w-4" />
                  Move to folder
                </button>
                <button onClick={() => open("assign")} className={menuItem}>
                  <UserIcon className="h-4 w-4" />
                  {file.assignedTo ? "Reassign" : "Assign to"}
                </button>
                <hr className="my-1 border-zinc-700" />
                <button
                  onClick={() => open("delete")}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </Dropdown>
        )}
      </div>

      {dialog === "preview" && (
        <FilePreviewModal isOpen onClose={() => setDialog(null)} file={file} />
      )}
      {dialog === "share" && (
        <ShareModal
          isOpen
          onClose={() => setDialog(null)}
          kind="file"
          itemName={file.name}
          sharedWithFamily={file.sharedWithFamily}
          sharedWith={file.sharedWith}
          onSave={(family, ids) => {
            shareFile(file.id, family, ids);
            toast("Sharing updated");
          }}
        />
      )}
      {dialog === "rename" && (
        <RenameModal
          isOpen
          onClose={() => setDialog(null)}
          title="Rename file"
          initialName={file.name}
          onRename={(name) => renameFile(file.id, name)}
        />
      )}
      {dialog === "assign" && (
        <AssignModal
          isOpen
          onClose={() => setDialog(null)}
          title="Assign file"
          description="Choose who this file should be assigned to."
          kind="file"
          currentAssignee={file.assignedTo}
          onAssign={(memberId) => {
            assignFiles([file.id], memberId);
            setDialog(null);
          }}
        />
      )}
      {dialog === "move" && (
        <FolderPickerModal
          isOpen
          onClose={() => setDialog(null)}
          title="Move file"
          description={`Select a destination for "${file.name}"`}
          currentFolderId={file.folderId}
          onMove={(folderId) => {
            moveFiles([file.id], folderId);
            toast("File moved");
          }}
        />
      )}
      {dialog === "delete" && (
        <ConfirmModal
          isOpen
          onClose={() => setDialog(null)}
          title="Delete file?"
          confirmLabel="Delete"
          onConfirm={() => {
            deleteFiles([file.id]);
            toast("File deleted");
          }}
        >
          Are you sure you want to delete &ldquo;{file.name}&rdquo;? This cannot
          be undone.
        </ConfirmModal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

export function DemoFolderCard({
  folder,
  parentFolderName,
  onOpen,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  folder: FolderView;
  parentFolderName?: string;
  onOpen: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect?: ToggleSelect;
}) {
  const {
    viewer,
    renameFolder,
    assignFolders,
    shareFolder,
    moveFolders,
    deleteFolders,
  } = useDemo();
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleteContents, setDeleteContents] = useState(false);

  const isOwner = viewer.role === "owner";
  const canShare = isOwner || folder.assignedTo === viewer.id;
  const isShared = folder.sharedWithFamily || folder.sharedWith.length > 0;

  const open = (d: Dialog) => {
    setShowMenu(false);
    setDialog(d);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest("button, input[type='checkbox'], label")
    )
      return;
    if (selectionMode && onToggleSelect) {
      onToggleSelect(folder.id, { shiftKey: e.shiftKey });
      return;
    }
    onOpen();
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={cn(
          "group relative cursor-pointer rounded-xl border bg-zinc-900 transition-all",
          isSelected
            ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/50"
            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 active:bg-zinc-800",
        )}
      >
        {isOwner && onToggleSelect && (
          <SelectCheckbox
            id={folder.id}
            isSelected={isSelected}
            selectionMode={selectionMode}
            onToggleSelect={onToggleSelect}
          />
        )}
        <div className="p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <FolderIcon className="h-6 w-6" />
          </div>
        </div>
        <div className="p-4 pt-0">
          <h3
            className="mb-1 truncate font-medium text-zinc-100"
            title={folder.name}
          >
            {folder.name}
          </h3>
          <div className="text-sm text-zinc-500">
            {folder.itemCount} {folder.itemCount === 1 ? "item" : "items"}
          </div>
          {parentFolderName && (
            <p className="mt-1 truncate text-xs text-zinc-500">
              in {parentFolderName}
            </p>
          )}
          {folder.assigneeName && (
            <p className="mt-2 text-xs text-zinc-500">
              Assigned to {folder.assigneeName}
            </p>
          )}
          {isOwner && (
            <SharingBadge
              family={folder.sharedWithFamily}
              count={folder.sharedWith.length}
            />
          )}
        </div>

        <MenuButton open={showMenu} onClick={() => setShowMenu(!showMenu)} />

        {showMenu && (
          <Dropdown onClose={() => setShowMenu(false)}>
            <button
              onClick={() => {
                setShowMenu(false);
                onOpen();
              }}
              className={menuItem}
            >
              <FolderIcon className="h-4 w-4" />
              Open folder
            </button>
            {canShare && (
              <button onClick={() => open("share")} className={menuItem}>
                <ShareIcon className="h-4 w-4" />
                {isShared ? "Manage sharing" : "Share with family"}
              </button>
            )}
            {isOwner && (
              <>
                <button onClick={() => open("rename")} className={menuItem}>
                  <EditIcon className="h-4 w-4" />
                  Rename
                </button>
                <button onClick={() => open("move")} className={menuItem}>
                  <MoveIcon className="h-4 w-4" />
                  Move
                </button>
                <button onClick={() => open("assign")} className={menuItem}>
                  <UserIcon className="h-4 w-4" />
                  {folder.assignedTo ? "Reassign" : "Assign to"}
                </button>
                <hr className="my-1 border-zinc-700" />
                <button
                  onClick={() => open("delete")}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </Dropdown>
        )}
      </div>

      {dialog === "share" && (
        <ShareModal
          isOpen
          onClose={() => setDialog(null)}
          kind="folder"
          itemName={folder.name}
          sharedWithFamily={folder.sharedWithFamily}
          sharedWith={folder.sharedWith}
          onSave={(family, ids) => {
            shareFolder(folder.id, family, ids);
            toast("Sharing updated");
          }}
        />
      )}
      {dialog === "rename" && (
        <RenameModal
          isOpen
          onClose={() => setDialog(null)}
          title="Rename folder"
          initialName={folder.name}
          onRename={(name) => renameFolder(folder.id, name)}
        />
      )}
      {dialog === "assign" && (
        <AssignModal
          isOpen
          onClose={() => setDialog(null)}
          title="Assign folder"
          description="Choose who this folder should be assigned to."
          kind="folder"
          currentAssignee={folder.assignedTo}
          onAssign={(memberId) => {
            assignFolders([folder.id], memberId);
            setDialog(null);
          }}
        />
      )}
      {dialog === "move" && (
        <FolderPickerModal
          isOpen
          onClose={() => setDialog(null)}
          title="Move folder"
          description={`Select a destination for "${folder.name}"`}
          currentFolderId={folder.parentFolderId}
          movingFolderIds={[folder.id]}
          onMove={(parentId) => {
            moveFolders([folder.id], parentId);
            toast("Folder moved");
          }}
        />
      )}
      {dialog === "delete" && (
        <ConfirmModal
          isOpen
          onClose={() => setDialog(null)}
          title="Delete folder?"
          confirmLabel="Delete"
          onConfirm={() => {
            deleteFolders([folder.id], deleteContents);
            toast("Folder deleted");
          }}
        >
          <p className="mb-4">
            Are you sure you want to delete &ldquo;{folder.name}&rdquo;?
          </p>
          {folder.itemCount > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <p className="mb-2 text-sm text-zinc-300">
                This folder contains {folder.itemCount}{" "}
                {folder.itemCount === 1 ? "item" : "items"}.
              </p>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={deleteContents}
                  onChange={(e) => setDeleteContents(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-700"
                />
                Delete all contents permanently
              </label>
              {!deleteContents && (
                <p className="mt-1 text-xs text-zinc-500">
                  Contents will be moved to the parent folder.
                </p>
              )}
            </div>
          )}
        </ConfirmModal>
      )}
    </>
  );
}
