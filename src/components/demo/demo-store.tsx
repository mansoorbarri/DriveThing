"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createSeedState,
  OWNER_ID,
  type DemoFile,
  type DemoFolder,
  type DemoMember,
  type DemoState,
} from "./demo-data";

// ---------------------------------------------------------------------------
// Selectors - mirror the visibility rules in convex/files.ts and convex/folders.ts
// ---------------------------------------------------------------------------

export interface FolderView extends DemoFolder {
  assigneeName?: string;
  itemCount: number;
}

export interface FileView extends DemoFile {
  assigneeName?: string;
  uploaderName?: string;
}

interface Scope {
  folderId?: string;
  all?: boolean;
}

const memberName = (state: DemoState, id?: string) =>
  id ? state.members.find((m) => m.id === id)?.name : undefined;

const inScope = (parentId: string | undefined, scope: Scope) =>
  scope.all ? true : parentId === scope.folderId;

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name);

function toFolderView(state: DemoState, folder: DemoFolder): FolderView {
  return {
    ...folder,
    assigneeName: memberName(state, folder.assignedTo),
    itemCount:
      state.files.filter((f) => f.folderId === folder.id).length +
      state.folders.filter((f) => f.parentFolderId === folder.id).length,
  };
}

export function selectMyFolders(
  state: DemoState,
  viewer: DemoMember,
  scope: Scope,
): FolderView[] {
  return state.folders
    .filter((f) => inScope(f.parentFolderId, scope))
    .filter(
      (f) =>
        viewer.role === "owner" || f.assignedTo === viewer.id || !f.assignedTo,
    )
    .map((f) => toFolderView(state, f))
    .sort(byName);
}

export function selectSharedFolders(
  state: DemoState,
  viewer: DemoMember,
  scope: Scope,
): FolderView[] {
  if (viewer.role === "owner") return []; // owner created every folder
  return state.folders
    .filter((f) => inScope(f.parentFolderId, scope))
    .filter(
      (f) =>
        f.assignedTo &&
        f.assignedTo !== viewer.id &&
        (f.sharedWithFamily || f.sharedWith.includes(viewer.id)),
    )
    .map((f) => toFolderView(state, f))
    .sort(byName);
}

export function selectMyFiles(
  state: DemoState,
  viewer: DemoMember,
  scope: Scope,
): FileView[] {
  return state.files
    .filter((f) => inScope(f.folderId, scope))
    .filter((f) =>
      viewer.role === "owner"
        ? f.uploadedBy === viewer.id
        : f.assignedTo === viewer.id || !f.assignedTo,
    )
    .map((f) => ({ ...f, assigneeName: memberName(state, f.assignedTo) }))
    .sort(byName);
}

export function selectSharedFiles(
  state: DemoState,
  viewer: DemoMember,
  scope: Scope,
): FileView[] {
  const sharedFolderIds = new Set(
    state.folders
      .filter(
        (f) =>
          f.assignedTo &&
          f.assignedTo !== viewer.id &&
          (f.sharedWithFamily || f.sharedWith.includes(viewer.id)),
      )
      .map((f) => f.id),
  );
  return state.files
    .filter((f) => inScope(f.folderId, scope))
    .filter((f) => {
      if (
        !f.assignedTo ||
        f.assignedTo === viewer.id ||
        f.uploadedBy === viewer.id
      )
        return false;
      if (f.sharedWithFamily || f.sharedWith.includes(viewer.id)) return true;
      return !!f.folderId && sharedFolderIds.has(f.folderId);
    })
    .map((f) => ({
      ...f,
      assigneeName: memberName(state, f.assignedTo),
      uploaderName: memberName(state, f.uploadedBy),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function selectFolderPath(
  state: DemoState,
  folderId?: string,
): { id: string; name: string }[] {
  const path: { id: string; name: string }[] = [];
  let current = state.folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift({ id: current.id, name: current.name });
    const parentId: string | undefined = current.parentFolderId;
    current = parentId
      ? state.folders.find((f) => f.id === parentId)
      : undefined;
  }
  return path;
}

function descendantFolderIds(
  folders: DemoFolder[],
  rootId: string,
): Set<string> {
  const ids = new Set([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (f.parentFolderId && ids.has(f.parentFolderId) && !ids.has(f.id)) {
        ids.add(f.id);
        added = true;
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface NewDemoFile {
  name: string;
  url: string;
  type: string;
  size: number;
  assignedTo?: string;
  folderId?: string;
  tags: string[];
}

interface DemoContextValue {
  state: DemoState;
  viewer: DemoMember;
  setViewerId: (id: string) => void;
  reset: () => void;
  renameFile: (id: string, name: string) => void;
  assignFiles: (ids: string[], assignedTo?: string) => void;
  shareFile: (id: string, family: boolean, withIds: string[]) => void;
  moveFiles: (ids: string[], folderId?: string) => void;
  deleteFiles: (ids: string[]) => void;
  addFiles: (files: NewDemoFile[]) => void;
  createFolder: (
    name: string,
    parentFolderId?: string,
    assignedTo?: string,
  ) => void;
  renameFolder: (id: string, name: string) => void;
  assignFolders: (ids: string[], assignedTo?: string) => void;
  shareFolder: (id: string, family: boolean, withIds: string[]) => void;
  moveFolders: (ids: string[], parentFolderId?: string) => void;
  deleteFolders: (ids: string[], deleteContents: boolean) => void;
  regenerateInviteCode: () => void;
  removeMember: (id: string) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-new-${Date.now()}-${idCounter++}`;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => createSeedState());
  const [viewerId, setViewerId] = useState(OWNER_ID);

  const viewer =
    state.members.find((m) => m.id === viewerId) ?? state.members[0]!;

  const updateFiles = useCallback(
    (ids: string[], patch: (f: DemoFile) => Partial<DemoFile>) =>
      setState((s) => ({
        ...s,
        files: s.files.map((f) =>
          ids.includes(f.id) ? { ...f, ...patch(f) } : f,
        ),
      })),
    [],
  );

  const updateFolders = useCallback(
    (ids: string[], patch: (f: DemoFolder) => Partial<DemoFolder>) =>
      setState((s) => ({
        ...s,
        folders: s.folders.map((f) =>
          ids.includes(f.id) ? { ...f, ...patch(f) } : f,
        ),
      })),
    [],
  );

  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      viewer,
      setViewerId,
      reset: () => {
        setState(createSeedState());
        setViewerId(OWNER_ID);
      },
      renameFile: (id, name) => updateFiles([id], () => ({ name })),
      assignFiles: (ids, assignedTo) =>
        updateFiles(ids, () => ({ assignedTo })),
      shareFile: (id, family, withIds) =>
        updateFiles([id], () => ({
          sharedWithFamily: family,
          sharedWith: family ? [] : withIds,
        })),
      moveFiles: (ids, folderId) => updateFiles(ids, () => ({ folderId })),
      deleteFiles: (ids) =>
        setState((s) => ({
          ...s,
          files: s.files.filter((f) => !ids.includes(f.id)),
        })),
      addFiles: (files) =>
        setState((s) => ({
          ...s,
          files: [
            ...s.files,
            ...files.map((f) => ({
              ...f,
              id: newId("file"),
              createdAt: Date.now(),
              sharedWithFamily: false,
              sharedWith: [],
              uploadedBy: OWNER_ID,
            })),
          ],
        })),
      createFolder: (name, parentFolderId, assignedTo) =>
        setState((s) => ({
          ...s,
          folders: [
            ...s.folders,
            {
              id: newId("folder"),
              name,
              parentFolderId,
              assignedTo,
              sharedWithFamily: false,
              sharedWith: [],
              createdAt: Date.now(),
            },
          ],
        })),
      renameFolder: (id, name) => updateFolders([id], () => ({ name })),
      assignFolders: (ids, assignedTo) =>
        updateFolders(ids, () => ({ assignedTo })),
      shareFolder: (id, family, withIds) =>
        updateFolders([id], () => ({
          sharedWithFamily: family,
          sharedWith: family ? [] : withIds,
        })),
      moveFolders: (ids, parentFolderId) =>
        setState((s) => {
          // Never move a folder into itself or one of its descendants
          const blocked = parentFolderId
            ? new Set(
                ids.filter((id) =>
                  descendantFolderIds(s.folders, id).has(parentFolderId),
                ),
              )
            : new Set<string>();
          return {
            ...s,
            folders: s.folders.map((f) =>
              ids.includes(f.id) && !blocked.has(f.id)
                ? { ...f, parentFolderId }
                : f,
            ),
          };
        }),
      deleteFolders: (ids, deleteContents) =>
        setState((s) => {
          if (deleteContents) {
            const doomed = new Set<string>();
            ids.forEach((id) =>
              descendantFolderIds(s.folders, id).forEach((d) => doomed.add(d)),
            );
            return {
              ...s,
              folders: s.folders.filter((f) => !doomed.has(f.id)),
              files: s.files.filter(
                (f) => !f.folderId || !doomed.has(f.folderId),
              ),
            };
          }
          // Move direct contents up to the parent folder
          const parentOf = new Map(
            s.folders.map((f) => [f.id, f.parentFolderId]),
          );
          return {
            ...s,
            folders: s.folders
              .filter((f) => !ids.includes(f.id))
              .map((f) =>
                f.parentFolderId && ids.includes(f.parentFolderId)
                  ? { ...f, parentFolderId: parentOf.get(f.parentFolderId) }
                  : f,
              ),
            files: s.files.map((f) =>
              f.folderId && ids.includes(f.folderId)
                ? { ...f, folderId: parentOf.get(f.folderId) }
                : f,
            ),
          };
        }),
      regenerateInviteCode: () =>
        setState((s) => ({
          ...s,
          workspace: {
            ...s.workspace,
            inviteCode: Array.from({ length: 6 }, () =>
              "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(
                Math.floor(Math.random() * 32),
              ),
            ).join(""),
          },
        })),
      removeMember: (id) =>
        setState((s) => ({
          ...s,
          members: s.members.filter((m) => m.id !== id),
          files: s.files.map((f) => ({
            ...f,
            assignedTo: f.assignedTo === id ? undefined : f.assignedTo,
            sharedWith: f.sharedWith.filter((x) => x !== id),
          })),
          folders: s.folders.map((f) => ({
            ...f,
            assignedTo: f.assignedTo === id ? undefined : f.assignedTo,
            sharedWith: f.sharedWith.filter((x) => x !== id),
          })),
        })),
    }),
    [state, viewer, updateFiles, updateFolders],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
