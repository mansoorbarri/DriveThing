"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FamilyIcon, PlusIcon } from "./icons";

export function FamilySetup() {
  const { user } = useUser();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createFamily = useMutation(api.families.createFamily);
  const joinFamily = useMutation(api.families.joinFamily);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !familyName.trim()) return;

    setLoading(true);
    setError("");

    try {
      await createFamily({
        name: familyName.trim(),
        clerkId: user.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create family");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      await joinFamily({
        inviteCode: inviteCode.trim().toUpperCase(),
        clerkId: user.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join family");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <FamilyIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="mt-2 text-gray-600">
            Create a new family or join an existing one to start storing files.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMode("create")}
            className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <PlusIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Create a family</p>
              <p className="text-sm text-gray-500">
                Start a new family and invite others
              </p>
            </div>
          </button>

          <button
            onClick={() => setMode("join")}
            className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <FamilyIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Join a family</p>
              <p className="text-sm text-gray-500">
                Enter an invite code to join
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <button
          onClick={() => {
            setMode("choose");
            setError("");
          }}
          className="mb-6 text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </button>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Create your family
        </h1>
        <p className="mb-6 text-gray-600">
          Choose a name for your family. You can invite others after.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Family name"
            placeholder="The Smiths"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            error={error}
            autoFocus
          />

          <Button type="submit" loading={loading} className="w-full">
            Create family
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <button
        onClick={() => {
          setMode("choose");
          setError("");
        }}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back
      </button>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Join a family</h1>
      <p className="mb-6 text-gray-600">
        Enter the 6-character invite code you received.
      </p>

      <form onSubmit={handleJoin} className="space-y-4">
        <Input
          label="Invite code"
          placeholder="ABC123"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          error={error}
          maxLength={6}
          className="text-center text-xl tracking-widest"
          autoFocus
        />

        <Button
          type="submit"
          loading={loading}
          disabled={inviteCode.length !== 6}
          className="w-full"
        >
          Join family
        </Button>
      </form>
    </div>
  );
}
