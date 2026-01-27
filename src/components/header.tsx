"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { SearchIcon, SettingsIcon, CloseIcon } from "./icons";
import { cn } from "~/lib/utils";

interface HeaderProps {
  familyName?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSettingsClick: () => void;
}

export function Header({
  familyName,
  searchQuery,
  onSearchChange,
  onSettingsClick,
}: HeaderProps) {
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
        {/* Logo / Family name */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 font-bold text-white">
            D
          </div>
          <span className="hidden font-semibold text-zinc-100 sm:block">
            {familyName ?? "DriveThing"}
          </span>
        </div>

        {/* Search - desktop */}
        <div className="hidden flex-1 sm:block">
          <div className="relative mx-auto max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-zinc-100",
                "placeholder-zinc-500 focus:border-violet-500 focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              )}
            />
          </div>
        </div>

        {/* Mobile search toggle */}
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

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>

        {/* User button */}
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-9 h-9",
            },
          }}
        />
      </div>

      {/* Mobile search bar */}
      {showMobileSearch && (
        <div className="border-t border-zinc-800 p-3 sm:hidden">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-4 text-sm text-zinc-100",
                "placeholder-zinc-500 focus:border-violet-500 focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              )}
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
