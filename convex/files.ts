import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Upload a new file (create metadata)
export const createFile = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    fileKey: v.string(),
    type: v.string(),
    size: v.number(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      throw new Error("User must be in a family to upload files");
    }

    return await ctx.db.insert("files", {
      name: args.name,
      url: args.url,
      fileKey: args.fileKey,
      type: args.type,
      size: args.size,
      uploadedBy: user._id,
      familyId: user.familyId,
      sharedWithFamily: false,
      createdAt: Date.now(),
    });
  },
});

// Get user's own files
export const getMyFiles = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return [];
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_uploader", (q) => q.eq("uploadedBy", user._id))
      .order("desc")
      .collect();

    return files;
  },
});

// Get files shared with family (that user can see)
export const getSharedFiles = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return [];
    }

    // Get all shared files in the family (excluding user's own)
    const files = await ctx.db
      .query("files")
      .withIndex("by_family_shared", (q) =>
        q.eq("familyId", user.familyId).eq("sharedWithFamily", true)
      )
      .order("desc")
      .collect();

    // Get uploader info for each file
    const filesWithUploader = await Promise.all(
      files
        .filter((f) => f.uploadedBy !== user._id)
        .map(async (file) => {
          const uploader = await ctx.db.get(file.uploadedBy);
          return {
            ...file,
            uploaderName: uploader?.name ?? "Unknown",
          };
        })
    );

    return filesWithUploader;
  },
});

// Toggle share status of a file
export const toggleShareFile = mutation({
  args: {
    fileId: v.id("files"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.uploadedBy !== user._id) {
      throw new Error("File not found or not owned by user");
    }

    await ctx.db.patch(args.fileId, {
      sharedWithFamily: !file.sharedWithFamily,
    });

    return !file.sharedWithFamily;
  },
});

// Delete a file
export const deleteFile = mutation({
  args: {
    fileId: v.id("files"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Only owner can delete, or family owner can delete any file in family
    const isFileOwner = file.uploadedBy === user._id;
    const isFamilyOwner = user.role === "owner" && file.familyId === user.familyId;

    if (!isFileOwner && !isFamilyOwner) {
      throw new Error("Not authorized to delete this file");
    }

    // Return the file key so we can delete from UploadThing
    const fileKey = file.fileKey;
    await ctx.db.delete(args.fileId);

    return { fileKey };
  },
});

// Rename a file
export const renameFile = mutation({
  args: {
    fileId: v.id("files"),
    newName: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.uploadedBy !== user._id) {
      throw new Error("File not found or not owned by user");
    }

    await ctx.db.patch(args.fileId, { name: args.newName });
  },
});

// Search files
export const searchFiles = query({
  args: {
    clerkId: v.string(),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return [];
    }

    // Get user's own files
    const myFiles = await ctx.db
      .query("files")
      .withIndex("by_uploader", (q) => q.eq("uploadedBy", user._id))
      .collect();

    // Get shared files if in a family
    let sharedFiles: typeof myFiles = [];
    if (user.familyId) {
      sharedFiles = await ctx.db
        .query("files")
        .withIndex("by_family_shared", (q) =>
          q.eq("familyId", user.familyId).eq("sharedWithFamily", true)
        )
        .collect();
      sharedFiles = sharedFiles.filter((f) => f.uploadedBy !== user._id);
    }

    const allFiles = [...myFiles, ...sharedFiles];
    const term = args.searchTerm.toLowerCase();

    return allFiles.filter((file) => file.name.toLowerCase().includes(term));
  },
});
