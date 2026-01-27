/* eslint-disable */
/**
 * Generated API types - placeholder until `convex dev` is run
 * This file will be overwritten when you run `convex dev`
 */

import type { FunctionReference } from "convex/server";
import type { Id, Doc } from "./dataModel";

export declare const api: {
  users: {
    getOrCreateUser: FunctionReference<
      "mutation",
      "public",
      {
        clerkId: string;
        email: string;
        name: string;
        imageUrl?: string;
      },
      Id<"users">
    >;
    getCurrentUser: FunctionReference<
      "query",
      "public",
      { clerkId: string },
      Doc<"users"> | null
    >;
    getUserWithFamily: FunctionReference<
      "query",
      "public",
      { clerkId: string },
      {
        user: Doc<"users"> | null;
        family: Doc<"families"> | null;
        members: Doc<"users">[];
      }
    >;
  };
  families: {
    createFamily: FunctionReference<
      "mutation",
      "public",
      { name: string; clerkId: string },
      Id<"families">
    >;
    joinFamily: FunctionReference<
      "mutation",
      "public",
      { inviteCode: string; clerkId: string },
      Id<"families">
    >;
    leaveFamily: FunctionReference<"mutation", "public", { clerkId: string }, void>;
    regenerateInviteCode: FunctionReference<
      "mutation",
      "public",
      { clerkId: string },
      string
    >;
    getFamily: FunctionReference<
      "query",
      "public",
      { familyId: Id<"families"> },
      Doc<"families"> | null
    >;
    getFamilyMembers: FunctionReference<
      "query",
      "public",
      { familyId: Id<"families"> },
      Doc<"users">[]
    >;
    removeMember: FunctionReference<
      "mutation",
      "public",
      { clerkId: string; memberUserId: Id<"users"> },
      void
    >;
  };
  files: {
    createFile: FunctionReference<
      "mutation",
      "public",
      {
        name: string;
        url: string;
        fileKey: string;
        type: string;
        size: number;
        clerkId: string;
      },
      Id<"files">
    >;
    getMyFiles: FunctionReference<
      "query",
      "public",
      { clerkId: string },
      Doc<"files">[]
    >;
    getSharedFiles: FunctionReference<
      "query",
      "public",
      { clerkId: string },
      Array<Doc<"files"> & { uploaderName: string }>
    >;
    toggleShareFile: FunctionReference<
      "mutation",
      "public",
      { fileId: Id<"files">; clerkId: string },
      boolean
    >;
    deleteFile: FunctionReference<
      "mutation",
      "public",
      { fileId: Id<"files">; clerkId: string },
      { fileKey: string }
    >;
    renameFile: FunctionReference<
      "mutation",
      "public",
      { fileId: Id<"files">; newName: string; clerkId: string },
      void
    >;
    searchFiles: FunctionReference<
      "query",
      "public",
      { clerkId: string; searchTerm: string },
      Doc<"files">[]
    >;
  };
};
