import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Families - a group of users sharing storage
  families: defineTable({
    name: v.string(),
    ownerId: v.string(), // Clerk user ID
    inviteCode: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_invite_code", ["inviteCode"]),

  // Users - extends Clerk user data
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    familyId: v.optional(v.id("families")),
    role: v.optional(v.union(v.literal("owner"), v.literal("member"))),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_family", ["familyId"]),

  // Folders - for organizing files
  folders: defineTable({
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")), // For nesting
    createdBy: v.id("users"),
    assignedTo: v.optional(v.id("users")),
    familyId: v.id("families"),
    sharedWithFamily: v.boolean(),
    sharedWith: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
  })
    .index("by_family", ["familyId"])
    .index("by_assigned", ["assignedTo"])
    .index("by_parent", ["parentFolderId"])
    .index("by_family_shared", ["familyId", "sharedWithFamily"]),

  // Files - stored file metadata
  files: defineTable({
    name: v.string(),
    originalName: v.string(), // Original filename
    url: v.string(),
    fileKey: v.string(), // UploadThing file key for deletion
    type: v.string(), // MIME type
    size: v.number(), // bytes
    uploadedBy: v.id("users"), // Who uploaded (always owner)
    assignedTo: v.optional(v.id("users")), // Which family member this belongs to
    familyId: v.id("families"),
    folderId: v.optional(v.id("folders")), // Which folder this file is in
    // Tags for organization
    tags: v.optional(v.array(v.string())),
    // Sharing options
    sharedWithFamily: v.boolean(), // if true, all family members can see
    sharedWith: v.optional(v.array(v.id("users"))), // specific users to share with
    createdAt: v.number(),
  })
    .index("by_uploader", ["uploadedBy"])
    .index("by_family", ["familyId"])
    .index("by_assigned", ["assignedTo"])
    .index("by_family_shared", ["familyId", "sharedWithFamily"])
    .index("by_folder", ["folderId"]),

  // Pending invites - for tracking sent invitations
  invites: defineTable({
    familyId: v.id("families"),
    email: v.string(),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired")
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_family", ["familyId"])
    .index("by_email", ["email"]),

  // Tags - predefined tags for the family
  tags: defineTable({
    name: v.string(),
    color: v.string(), // Hex color
    familyId: v.id("families"),
    createdAt: v.number(),
  }).index("by_family", ["familyId"]),
});
