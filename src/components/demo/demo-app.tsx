"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Modal } from "~/components/ui/modal";
import { EmptyState } from "~/components/ui/empty-state";
import { FilePreviewModal } from "~/components/file-preview-modal";
import { useToast } from "~/components/ui/toast";
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UploadIcon,
} from "~/components/icons";
import { cn } from "~/lib/utils";
import { OWNER_ID } from "./demo-data";
import {
  DemoProvider,
  selectFolderPath,
  selectMyFiles,
  selectMyFolders,
  selectSharedFiles,
  selectSharedFolders,
  useDemo,
  type FileView,
  type FolderView,
} from "./demo-store";
import { DemoFileCard, DemoFolderCard } from "./demo-cards";
import { DemoBulkBar } from "./demo-bulk-bar";
import { CreateFolderModal, SettingsModal } from "./demo-modals";
import { DemoUploader } from "./demo-uploader";

type Tab = "my-files" | "shared";

interface Section {
  id: string;
  title: string;
  variant: "owner" | "member" | "plain";
  avatar?: string;
  collapsible: boolean;
  folders: FolderView[];
  files: FileView[];
  folderSelectable: boolean;
  showUploader?: boolean;
}

const selectionKey = (kind: "file" | "folder", id: string) => `${kind}:${id}`;

export function DemoApp() {
  return (
    <DemoProvider>
      <DemoDashboard />
    </DemoProvider>
  );
}

function DemoDashboard() {
  const { state, viewer, setViewerId, reset } = useDemo();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("my-files");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileView | null>(null);

  const isOwner = viewer.role === "owner";
  const selectionMode = selectedFiles.size > 0 || selectedFolders.size > 0;

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setAnchorKey(null);
  }, []);

  // --- navigation with browser history (mirrors the real dashboard) -------
  const navigateToFolder = useCallback(
    (folderId?: string, skipHistory = false) => {
      setCurrentFolderId(folderId);
      setSearchQuery("");
      clearSelection();
      if (!skipHistory) {
        const url = new URL(window.location.href);
        if (folderId) url.searchParams.set("folder", folderId);
        else url.searchParams.delete("folder");
        window.history.pushState({ folderId }, "", url.toString());
      }
    },
    [clearSelection],
  );

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const s = event.state as { folderId?: string } | null;
      navigateToFolder(s?.folderId, true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigateToFolder]);

  const switchViewer = (id: string, tab: Tab = "my-files") => {
    setViewerId(id);
    setActiveTab(tab);
    setCollapsed(new Set());
    navigateToFolder(undefined);
    const member = state.members.find((m) => m.id === id);
    if (member) toast(`Now viewing as ${member.name}`, "info");
  };

  // --- data -----------------------------------------------------------------
  const scope = searchQuery ? { all: true } : { folderId: currentFolderId };
  const myFolders = selectMyFolders(state, viewer, scope);
  const sharedFolders = selectSharedFolders(state, viewer, scope);
  const myFiles = selectMyFiles(state, viewer, scope);
  const sharedFiles = selectSharedFiles(state, viewer, scope);
  const myFileTotal = selectMyFiles(state, viewer, {
    folderId: currentFolderId,
  }).length;
  const sharedFileTotal = selectSharedFiles(state, viewer, {
    folderId: currentFolderId,
  }).length;
  const folderPath = selectFolderPath(state, currentFolderId);
  const folderNames = useMemo(
    () => new Map(state.folders.map((f) => [f.id, f.name])),
    [state.folders],
  );
  const currentFolderAssignee = state.folders.find(
    (f) => f.id === currentFolderId,
  )?.assignedTo;

  const term = searchQuery.trim().toLowerCase();
  const folderMatches = (f: FolderView) =>
    !term ||
    f.name.toLowerCase().includes(term) ||
    !!f.assigneeName?.toLowerCase().includes(term);
  const fileMatches = (f: FileView) =>
    !term ||
    f.name.toLowerCase().includes(term) ||
    f.tags.some((t) => t.toLowerCase().includes(term)) ||
    (!!f.folderId &&
      !!folderNames.get(f.folderId)?.toLowerCase().includes(term)) ||
    !!f.assigneeName?.toLowerCase().includes(term);

  const sections: Section[] = (() => {
    const fFolders = myFolders.filter(folderMatches);
    const fFiles = myFiles.filter(fileMatches);

    if (activeTab === "shared") {
      const sFolders = sharedFolders.filter(folderMatches);
      const sFiles = sharedFiles.filter(fileMatches);
      const result: Section[] = [];
      if (sFolders.length) {
        result.push({
          id: "shared-folders",
          title: "Shared Folders",
          variant: "plain",
          collapsible: false,
          folders: sFolders,
          files: [],
          folderSelectable: false,
        });
      }
      const groups = new Map<string, FileView[]>();
      sFiles.forEach((f) => {
        const key = f.assigneeName ?? "Family Documents";
        groups.set(key, [...(groups.get(key) ?? []), f]);
      });
      [...groups.entries()]
        .sort(([a], [b]) =>
          a === "Family Documents"
            ? 1
            : b === "Family Documents"
              ? -1
              : a.localeCompare(b),
        )
        .forEach(([name, files]) =>
          result.push({
            id: `shared-${name}`,
            title: name === "Family Documents" ? name : `${name}'s Files`,
            variant: "plain",
            collapsible: false,
            folders: [],
            files,
            folderSelectable: false,
            showUploader: true,
          }),
        );
      return result;
    }

    if (isOwner) {
      const owner = state.members.find((m) => m.role === "owner");
      const ordered = [
        ...(owner ? [owner] : []),
        ...state.members.filter((m) => m.role !== "owner"),
      ];
      const result: Section[] = ordered.map((m) => ({
        id: m.id,
        title: `${m.name}'s Items`,
        variant: m.role === "owner" ? "owner" : "member",
        avatar: m.name[0]?.toUpperCase(),
        collapsible: true,
        folders: fFolders.filter((f) => f.assignedTo === m.id),
        files: fFiles.filter((f) => f.assignedTo === m.id),
        folderSelectable: true,
      }));
      result.push({
        id: "unassigned",
        title: "Family Items",
        variant: "member",
        collapsible: true,
        folders: fFolders.filter((f) => !f.assignedTo),
        files: fFiles.filter(
          (f) =>
            !f.assignedTo || !state.members.some((m) => m.id === f.assignedTo),
        ),
        folderSelectable: true,
      });
      return result.filter((s) => s.folders.length + s.files.length > 0);
    }

    return [
      {
        id: "folders",
        title: "Folders",
        variant: "plain" as const,
        collapsible: false,
        folders: fFolders,
        files: [],
        folderSelectable: false,
      },
      {
        id: "mine",
        title: "My Files",
        variant: "plain" as const,
        collapsible: false,
        folders: [],
        files: fFiles.filter((f) => f.assignedTo),
        folderSelectable: false,
      },
      {
        id: "family",
        title: "Family Documents",
        variant: "plain" as const,
        collapsible: false,
        folders: [],
        files: fFiles.filter((f) => !f.assignedTo),
        folderSelectable: false,
      },
    ].filter((s) => s.folders.length + s.files.length > 0);
  })();

  const isExpanded = (s: Section) => !s.collapsible || !collapsed.has(s.id);

  // Ordered list of selectable items currently on screen, for shift-click ranges
  const visibleItems = sections
    .filter(isExpanded)
    .flatMap((s) => [
      ...(s.folderSelectable
        ? s.folders.map((f) => ({ kind: "folder" as const, id: f.id }))
        : []),
      ...s.files.map((f) => ({ kind: "file" as const, id: f.id })),
    ]);

  const toggleSelection = (
    kind: "file" | "folder",
    id: string,
    options: { shiftKey?: boolean } = {},
  ) => {
    const key = selectionKey(kind, id);
    const isSelected =
      kind === "file" ? selectedFiles.has(id) : selectedFolders.has(id);
    const nextFiles = new Set(selectedFiles);
    const nextFolders = new Set(selectedFolders);

    const anchorIndex = anchorKey
      ? visibleItems.findIndex((i) => selectionKey(i.kind, i.id) === anchorKey)
      : -1;
    const targetIndex = visibleItems.findIndex(
      (i) => selectionKey(i.kind, i.id) === key,
    );

    if (options.shiftKey && anchorIndex !== -1 && targetIndex !== -1) {
      const [start, end] =
        anchorIndex < targetIndex
          ? [anchorIndex, targetIndex]
          : [targetIndex, anchorIndex];
      visibleItems.slice(start, end + 1).forEach((item) => {
        const set = item.kind === "file" ? nextFiles : nextFolders;
        if (isSelected) set.delete(item.id);
        else set.add(item.id);
      });
    } else {
      const set = kind === "file" ? nextFiles : nextFolders;
      if (isSelected) set.delete(id);
      else set.add(id);
    }

    setSelectedFiles(nextFiles);
    setSelectedFolders(nextFolders);
    setAnchorKey(nextFiles.size + nextFolders.size > 0 ? key : null);
  };

  const toggleSelectAll = (s: Section) => {
    const fileIds = s.files.map((f) => f.id);
    const folderIds = s.folderSelectable ? s.folders.map((f) => f.id) : [];
    const all =
      fileIds.every((id) => selectedFiles.has(id)) &&
      folderIds.every((id) => selectedFolders.has(id));
    const nextFiles = new Set(selectedFiles);
    const nextFolders = new Set(selectedFolders);
    fileIds.forEach((id) => (all ? nextFiles.delete(id) : nextFiles.add(id)));
    folderIds.forEach((id) =>
      all ? nextFolders.delete(id) : nextFolders.add(id),
    );
    setSelectedFiles(nextFiles);
    setSelectedFolders(nextFolders);
  };

  // --- guided tour actions --------------------------------------------------
  const findFile = (name: string) => state.files.find((f) => f.name === name);
  const openPreviewByName = (name: string) => {
    const file = findFile(name);
    if (file) setPreviewFile(file);
    else
      toast(
        "That file was renamed or deleted - hit Reset to restore it",
        "info",
      );
  };
  const tips: { label: string; hint: string; action: () => void }[] = [
    {
      label: "Open a PDF",
      hint: "Draft year-end accounts",
      action: () => openPreviewByName("Okafor-Draft-Accounts-FY2025-26.pdf"),
    },
    {
      label: "Preview a spreadsheet",
      hint: "4-sheet trial balance",
      action: () => openPreviewByName("Okafor-Trial-Balance-FY2025-26.xlsx"),
    },
    {
      label: "View a receipt photo",
      hint: "Snapped on a phone",
      action: () => openPreviewByName("Receipt-LNER-Train-York.jpg"),
    },
    {
      label: "Search 'receipt'",
      hint: "Matches names, tags, folders, people",
      action: () => {
        if (!isOwner) switchViewer(OWNER_ID);
        setActiveTab("my-files");
        setSearchQuery("receipt");
      },
    },
    {
      label: "Browse a client folder",
      hint: "Nested folders + breadcrumbs",
      action: () => {
        if (!isOwner) setViewerId(OWNER_ID);
        setActiveTab("my-files");
        navigateToFolder("f-okafor");
      },
    },
    {
      label: "Bulk select",
      hint: "Tick a card, shift-click for a range",
      action: () => {
        if (!isOwner) setViewerId(OWNER_ID);
        setActiveTab("my-files");
        navigateToFolder("f-lena-receipts");
        setTimeout(() => {
          setSelectedFiles(
            new Set(
              state.files
                .filter((f) => f.folderId === "f-lena-receipts")
                .map((f) => f.id),
            ),
          );
        }, 0);
      },
    },
    {
      label: "Be the client",
      hint: "See only Ade's files",
      action: () => switchViewer("m-ade"),
    },
    {
      label: "Be the bookkeeper",
      hint: "Files shared with Marcus",
      action: () => switchViewer("m-marcus", "shared"),
    },
    {
      label: "Upload your own file",
      hint: "Stays in your browser",
      action: () => {
        if (!isOwner) setViewerId(OWNER_ID);
        setShowUploader(true);
      },
    },
  ];

  // --- render helpers ---------------------------------------------------------
  const renderSection = (s: Section) => {
    const expanded = isExpanded(s);
    const fileIds = s.files.map((f) => f.id);
    const folderIds = s.folderSelectable ? s.folders.map((f) => f.id) : [];
    const totalSelectable = fileIds.length + folderIds.length;
    const selectedCount =
      fileIds.filter((id) => selectedFiles.has(id)).length +
      folderIds.filter((id) => selectedFolders.has(id)).length;
    const allSelected =
      totalSelectable > 0 && selectedCount === totalSelectable;
    const someSelected = selectedCount > 0 && !allSelected;

    const header = (
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          s.variant === "plain" && "mb-4",
        )}
      >
        {s.collapsible ? (
          <button
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(s.id)) next.delete(s.id);
                else next.add(s.id);
                return next;
              })
            }
            className={cn(
              "flex items-center gap-2 text-left text-sm font-medium",
              s.variant === "owner"
                ? "text-violet-400 hover:text-violet-300"
                : "text-zinc-400 hover:text-zinc-300",
            )}
          >
            <ChevronRightIcon
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-90",
              )}
            />
            {s.avatar && (
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  s.variant === "owner"
                    ? "bg-violet-500/20"
                    : "bg-zinc-700 text-zinc-300",
                )}
              >
                {s.avatar}
              </span>
            )}
            {s.title} ({s.folders.length + s.files.length})
          </button>
        ) : (
          <h3 className="text-sm font-medium text-zinc-400">
            {s.title} ({s.folders.length + s.files.length})
          </h3>
        )}
        {totalSelectable > 0 && (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors",
              s.variant === "owner"
                ? "hover:bg-violet-500/10"
                : "hover:bg-zinc-800",
              allSelected ? "text-violet-400" : "text-zinc-500",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                allSelected
                  ? "border-violet-500 bg-violet-500"
                  : someSelected
                    ? "border-violet-500 bg-violet-500/50"
                    : "border-zinc-600",
              )}
            >
              {(allSelected || someSelected) && (
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={allSelected ? "M5 13l4 4L19 7" : "M20 12H4"}
                  />
                </svg>
              )}
            </span>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => toggleSelectAll(s)}
              className="sr-only"
            />
            Select all
          </label>
        )}
      </div>
    );

    const grid = expanded && (
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
          s.variant !== "plain" && "mt-4",
        )}
      >
        {s.folders.map((folder) => (
          <DemoFolderCard
            key={folder.id}
            folder={folder}
            parentFolderName={
              searchQuery && folder.parentFolderId
                ? folderNames.get(folder.parentFolderId)
                : undefined
            }
            onOpen={() => navigateToFolder(folder.id)}
            selectionMode={selectionMode}
            isSelected={selectedFolders.has(folder.id)}
            onToggleSelect={
              s.folderSelectable
                ? (id, o) => toggleSelection("folder", id, o)
                : undefined
            }
          />
        ))}
        {s.files.map((file) => (
          <DemoFileCard
            key={file.id}
            file={file}
            folderName={
              searchQuery && file.folderId
                ? folderNames.get(file.folderId)
                : undefined
            }
            showUploader={s.showUploader}
            selectionMode={selectionMode}
            isSelected={selectedFiles.has(file.id)}
            onToggleSelect={(id, o) => toggleSelection("file", id, o)}
          />
        ))}
      </div>
    );

    if (s.variant === "plain") {
      return (
        <div key={s.id}>
          {header}
          {grid}
        </div>
      );
    }
    return (
      <div
        key={s.id}
        className={cn(
          "rounded-xl border p-4",
          s.variant === "owner"
            ? "border-violet-500/30 bg-violet-500/5"
            : "border-zinc-800 bg-zinc-900/50",
        )}
      >
        {header}
        {grid}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Demo banner */}
      <div className="border-b border-violet-500/20 bg-gradient-to-r from-violet-600/20 via-violet-500/10 to-transparent">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-violet-300 uppercase">
            Live demo
          </span>
          <span className="text-zinc-300">
            A fictional accounting practice. Everything works, nothing is saved
            - refresh to start over.
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => {
                reset();
                setActiveTab("my-files");
                setCollapsed(new Set());
                navigateToFolder(undefined);
                toast("Demo reset", "info");
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Reset
            </button>
            <Link
              href="/"
              className="font-medium text-violet-300 hover:text-violet-200"
            >
              Get DriveThing →
            </Link>
          </div>
        </div>
      </div>

      <DemoHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSettingsClick={() => setShowSettings(true)}
        onSwitchViewer={switchViewer}
      />

      <main
        className={cn(
          "mx-auto max-w-5xl px-4 pt-6",
          selectionMode
            ? "pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-[calc(9rem+env(safe-area-inset-bottom))]"
            : "pb-24",
        )}
      >
        {/* Guided tour */}
        {showTips ? (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-100">
                  Welcome to {state.workspace.name}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    Viewing as {viewer.name} ·{" "}
                    {viewer.role === "owner" ? "Owner" : "Member"}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Eleanor runs a small practice: her bookkeeper and three
                  clients each get their own space. Try these:
                </p>
              </div>
              <button
                onClick={() => setShowTips(false)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Hide tips"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {tips.map((tip) => (
                <button
                  key={tip.label}
                  onClick={tip.action}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition-colors hover:border-violet-500/50 hover:bg-violet-500/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-200">
                      {tip.label}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {tip.hint}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-violet-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowTips(true)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
          >
            <EyeIcon className="h-4 w-4" />
            Show demo tips
          </button>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-zinc-900 p-1">
          {(["my-files", "shared"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                navigateToFolder(undefined);
              }}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {tab === "my-files"
                ? isOwner
                  ? "All Files"
                  : "My Files"
                : "Shared with me"}
              {(tab === "my-files" ? myFileTotal : sharedFileTotal) > 0 && (
                <span className="ml-1.5 text-zinc-500">
                  ({tab === "my-files" ? myFileTotal : sharedFileTotal})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        {currentFolderId && folderPath.length > 0 && !searchQuery && (
          <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm">
            <button
              onClick={() => navigateToFolder(undefined)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <HomeIcon className="h-4 w-4" />
              <span>Home</span>
            </button>
            {folderPath.map((f, i) => (
              <div key={f.id} className="flex items-center">
                <ChevronRightIcon className="h-4 w-4 text-zinc-600" />
                <button
                  onClick={() => navigateToFolder(f.id)}
                  disabled={i === folderPath.length - 1}
                  className={cn(
                    "rounded-md px-2 py-1",
                    i === folderPath.length - 1
                      ? "font-medium text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                  )}
                >
                  {f.name}
                </button>
              </div>
            ))}
          </nav>
        )}

        {searchQuery && (
          <p className="mb-4 text-sm text-zinc-500">
            Results for &ldquo;
            <span className="text-zinc-300">{searchQuery}</span>&rdquo; across
            every folder
          </p>
        )}

        {sections.length === 0 ? (
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
                : activeTab === "shared"
                  ? "No shared files"
                  : currentFolderId
                    ? "Empty folder"
                    : "No files yet"
            }
            description={
              searchQuery
                ? "Try a different search term"
                : activeTab === "shared"
                  ? "Files shared by family members will appear here"
                  : isOwner
                    ? "Upload files or create subfolders"
                    : "Files assigned to you will appear here"
            }
            action={
              !searchQuery &&
              isOwner &&
              activeTab === "my-files" && (
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
        ) : (
          <div className="space-y-8">{sections.map(renderSection)}</div>
        )}
      </main>

      {/* Floating action button - owner only */}
      {isOwner && (
        <div
          className={cn(
            "fixed right-6 z-20 md:right-8",
            selectionMode ? "bottom-20 md:bottom-24" : "bottom-6 md:bottom-8",
          )}
        >
          {showFabMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFabMenu(false)}
              />
              <div className="absolute right-0 bottom-16 z-20 mb-2 flex flex-col items-end gap-2">
                <button
                  onClick={() => {
                    setShowFabMenu(false);
                    setShowCreateFolder(true);
                  }}
                  className="flex items-center gap-3 rounded-full bg-zinc-800 py-2 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-zinc-200 shadow-lg transition-colors hover:bg-zinc-700"
                >
                  <span>New folder</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
                    <FolderIcon className="h-5 w-5" />
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowFabMenu(false);
                    setShowUploader(true);
                  }}
                  className="flex items-center gap-3 rounded-full bg-zinc-800 py-2 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-zinc-200 shadow-lg transition-colors hover:bg-zinc-700"
                >
                  <span>Upload files</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-white">
                    <UploadIcon className="h-5 w-5" />
                  </span>
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setShowFabMenu(!showFabMenu)}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-all",
              "hover:bg-violet-500 active:bg-violet-700",
              showFabMenu && "rotate-45 bg-zinc-700 hover:bg-zinc-600",
            )}
            aria-label="Add new"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      <Modal
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        title="Upload files"
      >
        {showUploader && (
          <DemoUploader
            onClose={() => setShowUploader(false)}
            currentFolderId={currentFolderId}
            currentFolderAssignee={currentFolderAssignee}
          />
        )}
      </Modal>

      {showCreateFolder && (
        <CreateFolderModal
          isOpen
          onClose={() => setShowCreateFolder(false)}
          parentFolderId={currentFolderId}
          defaultAssignee={currentFolderAssignee}
          onCreated={(name) => toast(`Folder "${name}" created`)}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {previewFile && (
        <FilePreviewModal
          isOpen
          onClose={() => setPreviewFile(null)}
          file={previewFile}
        />
      )}

      {selectionMode && (
        <DemoBulkBar
          fileIds={selectedFiles}
          folderIds={selectedFolders}
          onClear={clearSelection}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function DemoHeader({
  searchQuery,
  onSearchChange,
  onSettingsClick,
  onSwitchViewer,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSettingsClick: () => void;
  onSwitchViewer: (id: string) => void;
}) {
  const { state, viewer } = useDemo();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showViewerMenu, setShowViewerMenu] = useState(false);

  const searchInput = (extra: string) => (
    <div className="relative">
      <SearchIcon className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-500" />
      <input
        type="text"
        placeholder="Search by name, tag, folder, or member..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className={cn(
          "w-full rounded-lg border border-zinc-700 bg-zinc-800 pr-4 pl-10 text-sm text-zinc-100",
          "placeholder-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none",
          extra,
        )}
      />
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 font-bold text-white">
            D
          </div>
          <span className="hidden font-semibold text-zinc-100 sm:block">
            {state.workspace.name}
          </span>
        </div>

        <div className="hidden flex-1 sm:block">
          <div className="mx-auto max-w-md">{searchInput("py-2")}</div>
        </div>

        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="ml-auto rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 sm:hidden"
          aria-label="Search"
        >
          {showMobileSearch ? (
            <CloseIcon className="h-5 w-5" />
          ) : (
            <SearchIcon className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={onSettingsClick}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>

        {/* Stand-in for the Clerk user button: lets you switch who you are */}
        <div className="relative">
          <button
            onClick={() => setShowViewerMenu(!showViewerMenu)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-offset-2 ring-offset-zinc-900 transition",
              viewer.role === "owner"
                ? "bg-violet-600 text-white ring-violet-500/40"
                : "bg-zinc-700 text-zinc-100 ring-zinc-600",
            )}
            aria-label="Switch demo user"
            title={`Viewing as ${viewer.name}`}
          >
            {viewer.name[0]}
          </button>
          {showViewerMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowViewerMenu(false)}
              />
              <div className="absolute top-12 right-0 z-20 w-72 rounded-xl border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
                <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  View the demo as
                </p>
                {state.members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setShowViewerMenu(false);
                      if (m.id !== viewer.id) onSwitchViewer(m.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-700",
                      m.id === viewer.id && "bg-zinc-700/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
                        m.role === "owner"
                          ? "bg-violet-500/30 text-violet-200"
                          : "bg-zinc-700 text-zinc-300",
                      )}
                    >
                      {m.name[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">
                        {m.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {m.role === "owner" ? "Owner" : "Member"} · {m.title}
                      </span>
                    </span>
                    {m.id === viewer.id && (
                      <CheckIcon className="h-4 w-4 text-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showMobileSearch && (
        <div className="border-t border-zinc-800 p-3 sm:hidden">
          {searchInput("py-2.5")}
        </div>
      )}
    </header>
  );
}
