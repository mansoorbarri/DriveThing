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

  // Files - stored file metadata
  files: defineTable({
    name: v.string(),
    originalName: v.string(), // Original filename
    url: v.string(),
    fileKey: v.string(), // UploadThing file key for deletion
    type: v.string(), // MIME type
    size: v.number(), // bytes
    uploadedBy: v.id("users"),
    familyId: v.id("families"),
    // Sharing options
    sharedWithFamily: v.boolean(), // if true, all family members can see
    sharedWith: v.optional(v.array(v.id("users"))), // specific users to share with
    createdAt: v.number(),
  })
    .index("by_uploader", ["uploadedBy"])
    .index("by_family", ["familyId"])
    .index("by_family_shared", ["familyId", "sharedWithFamily"]),

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
});
