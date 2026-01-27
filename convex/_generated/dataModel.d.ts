/* eslint-disable */
/**
 * Generated data model types - placeholder until `convex dev` is run
 * This file will be overwritten when you run `convex dev`
 */

export type Id<T extends string> = string & { __tableName: T };

export type Doc<T extends "families" | "users" | "files" | "invites"> =
  T extends "families"
    ? {
        _id: Id<"families">;
        _creationTime: number;
        name: string;
        ownerId: string;
        inviteCode: string;
        createdAt: number;
      }
    : T extends "users"
      ? {
          _id: Id<"users">;
          _creationTime: number;
          clerkId: string;
          email: string;
          name: string;
          imageUrl?: string;
          familyId?: Id<"families">;
          role?: "owner" | "member";
          createdAt: number;
        }
      : T extends "files"
        ? {
            _id: Id<"files">;
            _creationTime: number;
            name: string;
            url: string;
            fileKey: string;
            type: string;
            size: number;
            uploadedBy: Id<"users">;
            familyId: Id<"families">;
            sharedWithFamily: boolean;
            createdAt: number;
          }
        : T extends "invites"
          ? {
              _id: Id<"invites">;
              _creationTime: number;
              familyId: Id<"families">;
              email: string;
              invitedBy: Id<"users">;
              status: "pending" | "accepted" | "expired";
              createdAt: number;
              expiresAt: number;
            }
          : never;
