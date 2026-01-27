"use client";

import type { Id } from "../../convex/_generated/dataModel";
import { ChevronRightIcon, HomeIcon } from "./icons";

interface BreadcrumbItem {
  _id: Id<"folders">;
  name: string;
}

interface FolderBreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (folderId?: Id<"folders">) => void;
}

export function FolderBreadcrumb({ path, onNavigate }: FolderBreadcrumbProps) {
  return (
    <nav className="mb-4 flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate(undefined)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      >
        <HomeIcon className="h-4 w-4" />
        <span>Home</span>
      </button>

      {path.map((folder, index) => (
        <div key={folder._id} className="flex items-center">
          <ChevronRightIcon className="h-4 w-4 text-zinc-600" />
          <button
            onClick={() => onNavigate(folder._id)}
            className={`rounded-md px-2 py-1 ${
              index === path.length - 1
                ? "font-medium text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            disabled={index === path.length - 1}
          >
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
