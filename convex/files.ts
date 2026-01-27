import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Upload a new file (create metadata) - OWNER ONLY
export const createFile = mutation({
  args: {
    name: v.string(),
    originalName: v.string(),
    url: v.string(),
    fileKey: v.string(),
    type: v.string(),
    size: v.number(),
    clerkId: v.string(),
    assignedTo: v.optional(v.id("users")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      throw new Error("User must be in a family to upload files");
    }

    // Only owners can upload files
    if (user.role !== "owner") {
      throw new Error("Only family owners can upload files");
    }

    return await ctx.db.insert("files", {
      name: args.name,
      originalName: args.originalName,
      url: args.url,
      fileKey: args.fileKey,
      type: args.type,
      size: args.size,
      uploadedBy: user._id,
      assignedTo: args.assignedTo,
      familyId: user.familyId,
      tags: args.tags ?? [],
      sharedWithFamily: false,
      sharedWith: [],
      createdAt: Date.now(),
    });
  },
});

// Get all files in the family (for owner)
export const getAllFamilyFiles = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return [];
    }

    const familyId = user.familyId;

    const files = await ctx.db
      .query("files")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .order("desc")
      .collect();

    // Get assigned user info for each file
    const filesWithAssignee = await Promise.all(
      files.map(async (file) => {
        let assigneeName: string | undefined;
        if (file.assignedTo) {
          const assignee = await ctx.db.get(file.assignedTo);
          assigneeName = assignee?.name;
        }
        return {
          ...file,
          assigneeName,
        };
      })
    );

    return filesWithAssignee;
  },
});

// Get files assigned to current user (for members)
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

    // If owner, get files they uploaded (for backwards compatibility)
    if (user.role === "owner") {
      const files = await ctx.db
        .query("files")
        .withIndex("by_uploader", (q) => q.eq("uploadedBy", user._id))
        .order("desc")
        .collect();

      // Get assigned user info
      const filesWithAssignee = await Promise.all(
        files.map(async (file) => {
          let assigneeName: string | undefined;
          if (file.assignedTo) {
            const assignee = await ctx.db.get(file.assignedTo);
            assigneeName = assignee?.name;
          }
          return {
            ...file,
            assigneeName,
          };
        })
      );

      return filesWithAssignee;
    }

    // For members, get files assigned to them
    const files = await ctx.db
      .query("files")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", user._id))
      .order("desc")
      .collect();

    return files.map((file) => ({
      ...file,
      assigneeName: user.name,
    }));
  },
});

// Get files shared with the current user
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

    const familyId = user.familyId;

    // Get all files in the family
    const allFamilyFiles = await ctx.db
      .query("files")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .order("desc")
      .collect();

    // Filter to files user can see:
    // 1. Shared with whole family (and not assigned to them - they see those in My Files)
    // 2. Specifically shared with this user (and not assigned to them)
    const visibleFiles = allFamilyFiles.filter((file) => {
      // Exclude files assigned to this user (they see those in My Files)
      if (file.assignedTo === user._id) return false;
      // Exclude files uploaded by this user (owner sees in My Files)
      if (file.uploadedBy === user._id) return false;
      if (file.sharedWithFamily) return true;
      if (file.sharedWith?.includes(user._id)) return true;
      return false;
    });

    // Get uploader and assignee info for each file
    const filesWithInfo = await Promise.all(
      visibleFiles.map(async (file) => {
        const uploader = await ctx.db.get(file.uploadedBy);
        let assigneeName: string | undefined;
        if (file.assignedTo) {
          const assignee = await ctx.db.get(file.assignedTo);
          assigneeName = assignee?.name;
        }
        return {
          ...file,
          uploaderName: uploader?.name ?? "Unknown",
          assigneeName,
        };
      })
    );

    return filesWithInfo;
  },
});

// Update file sharing settings
export const updateFileSharing = mutation({
  args: {
    fileId: v.id("files"),
    clerkId: v.string(),
    shareWithFamily: v.boolean(),
    sharedWith: v.array(v.id("users")),
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
      sharedWithFamily: args.shareWithFamily,
      sharedWith: args.sharedWith,
    });
  },
});

// Toggle share with whole family (legacy support)
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

    // Only owner can delete (they uploaded all files)
    if (user.role !== "owner" || file.uploadedBy !== user._id) {
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

// Update file tags
export const updateFileTags = mutation({
  args: {
    fileId: v.id("files"),
    clerkId: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || user.role !== "owner") {
      throw new Error("Only owners can update file tags");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.uploadedBy !== user._id) {
      throw new Error("File not found or not owned by user");
    }

    await ctx.db.patch(args.fileId, { tags: args.tags });
  },
});

// Update file assignment
export const updateFileAssignment = mutation({
  args: {
    fileId: v.id("files"),
    clerkId: v.string(),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || user.role !== "owner") {
      throw new Error("Only owners can reassign files");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file || file.uploadedBy !== user._id) {
      throw new Error("File not found or not owned by user");
    }

    await ctx.db.patch(args.fileId, { assignedTo: args.assignedTo });
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

    const term = args.searchTerm.toLowerCase();

    // Get user's files based on role
    let myFiles;
    if (user.role === "owner" && user.familyId) {
      // Owner sees all family files
      myFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
        .collect();
    } else {
      // Member sees assigned files
      myFiles = await ctx.db
        .query("files")
        .withIndex("by_assigned", (q) => q.eq("assignedTo", user._id))
        .collect();
    }

    // Filter by search term (name or tags)
    return myFiles.filter((file) => {
      if (file.name.toLowerCase().includes(term)) return true;
      if (file.tags?.some((tag) => tag.toLowerCase().includes(term)))
        return true;
      return false;
    });
  },
});

// Get all tags used in the family
export const getFamilyTags = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return [];
    }

    const familyId = user.familyId;

    // Get all files in family
    const files = await ctx.db
      .query("files")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .collect();

    // Collect unique tags
    const tagSet = new Set<string>();
    files.forEach((file) => {
      file.tags?.forEach((tag) => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  },
});
