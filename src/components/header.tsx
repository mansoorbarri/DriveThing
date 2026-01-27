"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { SearchIcon, SettingsIcon, MenuIcon, CloseIcon } from "./icons";
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
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
        {/* Logo / Family name */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
            F
          </div>
          <span className="hidden font-semibold text-gray-900 sm:block">
            {familyName ?? "Family Drive"}
          </span>
        </div>

        {/* Search - desktop */}
        <div className="hidden flex-1 sm:block">
          <div className="relative mx-auto max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm",
                "placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              )}
            />
          </div>
        </div>

        {/* Mobile search toggle */}
        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="ml-auto rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:hidden"
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
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>

        {/* User button */}
        <UserButton afterSignOutUrl="/" />
      </div>

      {/* Mobile search bar */}
      {showMobileSearch && (
        <div className="border-t border-gray-100 p-3 sm:hidden">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm",
                "placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              )}
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
