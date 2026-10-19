"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { useToast } from "~/components/ui/toast";
import {
  CloseIcon,
  DownloadIcon,
  MoveIcon,
  TrashIcon,
  UserIcon,
} from "~/components/icons";
import { downloadFile } from "~/lib/utils";
import { useDemo } from "./demo-store";
import { AssignModal, ConfirmModal, FolderPickerModal } from "./demo-modals";

export function DemoBulkBar({
  fileIds,
  folderIds,
  onClear,
}: {
  fileIds: Set<string>;
  folderIds: Set<string>;
  onClear: () => void;
}) {
  const {
    state,
    viewer,
    assignFiles,
    assignFolders,
    moveFiles,
    moveFolders,
    deleteFiles,
    deleteFolders,
  } = useDemo();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<"assign" | "move" | "delete" | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const fileCount = fileIds.size;
  const folderCount = folderIds.size;
  const total = fileCount + folderCount;
  const canManage = viewer.role === "owner";
  if (total === 0) return null;

  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  const selectionText = [
    fileCount && plural(fileCount, "file"),
    folderCount && plural(folderCount, "folder"),
  ]
    .filter(Boolean)
    .join(" and ");
  const itemText =
    fileCount && folderCount
      ? `${total} items`
      : folderCount
        ? plural(folderCount, "folder")
        : plural(fileCount, "file");

  const selectedFiles = state.files.filter((f) => fileIds.has(f.id));

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      for (const file of selectedFiles) {
        await downloadFile(file.name, file.url);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-zinc-700 bg-zinc-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClear}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Clear selection"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-zinc-200">
              {selectionText} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {fileCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                loading={isDownloading}
                className="gap-2"
              >
                <DownloadIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
            {canManage && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDialog("assign")}
                  className="gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Assign</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDialog("move")}
                  className="gap-2"
                >
                  <MoveIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Move</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDialog("delete")}
                  className="gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {dialog === "assign" && (
        <AssignModal
          isOpen
          onClose={() => setDialog(null)}
          title={`Assign ${itemText}`}
          description={`Choose who ${total === 1 ? "this" : "these"} should be assigned to.`}
          kind={fileCount ? "file" : "folder"}
          currentAssignee={null}
          onAssign={(memberId) => {
            assignFiles([...fileIds], memberId);
            assignFolders([...folderIds], memberId);
            toast(`${itemText} assigned`);
            setDialog(null);
            onClear();
          }}
        />
      )}
      {dialog === "move" && (
        <FolderPickerModal
          isOpen
          onClose={() => setDialog(null)}
          title={`Move ${itemText}`}
          description="Select a destination folder."
          currentFolderId={null}
          movingFolderIds={[...folderIds]}
          onMove={(folderId) => {
            moveFiles([...fileIds], folderId);
            moveFolders([...folderIds], folderId);
            toast(`${itemText} moved`);
            onClear();
          }}
        />
      )}
      {dialog === "delete" && (
        <ConfirmModal
          isOpen
          onClose={() => setDialog(null)}
          title={`Delete ${itemText}?`}
          confirmLabel={`Delete ${itemText}`}
          onConfirm={() => {
            deleteFiles([...fileIds]);
            deleteFolders([...folderIds], true);
            toast(`${itemText} deleted`);
            onClear();
          }}
        >
          Are you sure you want to delete {selectionText}? This cannot be
          undone.
          {folderCount > 0 &&
            " All contents inside the selected folders will also be deleted."}
        </ConfirmModal>
      )}
    </>
  );
}
