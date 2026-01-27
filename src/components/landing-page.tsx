"use client";

import { useState } from "react";
import { SignIn } from "@clerk/nextjs";

export function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <main
        className={`flex min-h-screen flex-col bg-[#0a0a0b] transition-all duration-300 ${
          showSignIn ? "blur-sm scale-[1.02]" : ""
        }`}
      >
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-2xl font-bold text-white">
            D
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            DriveThing
          </h1>
          <p className="mb-8 max-w-md text-lg text-zinc-500">
            No complicated folders, just your files.
          </p>

          <button
            onClick={() => setShowSignIn(true)}
            className="rounded-lg bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-500 transition-colors"
          >
            Get started
          </button>
        </div>

        <footer className="border-t border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
          DriveThing
        </footer>
      </main>

      {/* Sign in overlay */}
      {showSignIn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSignIn(false)}
        >
          <div
            className="relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SignIn
              routing="hash"
              forceRedirectUrl="/dashboard"
            />
          </div>
        </div>
      )}
    </>
  );
}
