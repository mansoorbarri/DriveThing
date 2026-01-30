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
    folderId: v.optional(v.id("folders")),
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

    // Validate folder if provided
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.familyId !== user.familyId) {
        throw new Error("Folder not found");
      }
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
      folderId: args.folderId,
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

    // Sort alphabetically by name
    return filesWithAssignee.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get files for current user
// - Owners see all files they uploaded
// - Members see files assigned to them + unassigned family documents
// - Can filter by folder or get only root files
export const getMyFiles = query({
  args: {
    clerkId: v.string(),
    folderId: v.optional(v.id("folders")),
    rootOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return [];
    }

    const familyId = user.familyId;

    // Get files based on folder filter
    let allFamilyFiles;
    if (args.folderId) {
      // Get files in specific folder
      allFamilyFiles = await ctx.db
        .query("files")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
        .order("desc")
        .collect();
      // Filter to only files in user's family
      allFamilyFiles = allFamilyFiles.filter((f) => f.familyId === familyId);
    } else if (args.rootOnly) {
      // Get files at root level (no folder)
      const allFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .order("desc")
        .collect();
      allFamilyFiles = allFiles.filter((f) => !f.folderId);
    } else {
      // Get all files in the family (legacy behavior)
      allFamilyFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .order("desc")
        .collect();
    }

    // Filter based on role
    let myFiles;
    if (user.role === "owner") {
      // Owner sees all files they uploaded
      myFiles = allFamilyFiles.filter((file) => file.uploadedBy === user._id);
    } else {
      // Members see files assigned to them + unassigned family documents
      myFiles = allFamilyFiles.filter(
        (file) => file.assignedTo === user._id || !file.assignedTo
      );
    }

    // Get assigned user info for each file
    const filesWithAssignee = await Promise.all(
      myFiles.map(async (file) => {
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

    // Sort alphabetically by name
    return filesWithAssignee.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get files shared with the current user
// Includes files in shared folders
export const getSharedFiles = query({
  args: {
    clerkId: v.string(),
    folderId: v.optional(v.id("folders")),
    rootOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return [];
    }

    const familyId = user.familyId;

    // Get all files based on folder filter
    let allFamilyFiles;
    if (args.folderId) {
      allFamilyFiles = await ctx.db
        .query("files")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
        .order("desc")
        .collect();
      allFamilyFiles = allFamilyFiles.filter((f) => f.familyId === familyId);
    } else if (args.rootOnly) {
      const allFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .order("desc")
        .collect();
      allFamilyFiles = allFiles.filter((f) => !f.folderId);
    } else {
      allFamilyFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", familyId))
        .order("desc")
        .collect();
    }

    // Get shared folders to check for files inside shared folders
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .collect();

    const sharedFolderIds = new Set(
      allFolders
        .filter((folder) => {
          if (folder.createdBy === user._id) return false;
          if (folder.assignedTo === user._id) return false;
          if (!folder.assignedTo) return false;
          return folder.sharedWithFamily || folder.sharedWith?.includes(user._id);
        })
        .map((f) => f._id)
    );

    // Filter to files user can see
    const visibleFiles = allFamilyFiles.filter((file) => {
      // Exclude unassigned files (family documents) - they appear in My Files for everyone
      if (!file.assignedTo) return false;
      // Exclude files assigned to this user (they see those in My Files)
      if (file.assignedTo === user._id) return false;
      // Exclude files uploaded by this user (owner sees in My Files)
      if (file.uploadedBy === user._id) return false;
      // Include if file is shared
      if (file.sharedWithFamily) return true;
      if (file.sharedWith?.includes(user._id)) return true;
      // Include if file is in a shared folder
      if (file.folderId && sharedFolderIds.has(file.folderId)) return true;
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

    // Sort alphabetically by name
    return filesWithInfo.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Update file sharing settings
// Owners can share any file they uploaded
// Members can share files assigned to them
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
    if (!file) {
      throw new Error("File not found");
    }

    // Allow if user is the uploader (owner) OR if the file is assigned to them
    const canShare =
      file.uploadedBy === user._id || file.assignedTo === user._id;

    if (!canShare) {
      throw new Error("Not authorized to share this file");
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
    if (!file) {
      throw new Error("File not found");
    }

    // Allow if user is the uploader (owner) OR if the file is assigned to them
    const canShare =
      file.uploadedBy === user._id || file.assignedTo === user._id;

    if (!canShare) {
      throw new Error("Not authorized to share this file");
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

    return { fileKey: file.fileKey };
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

    if (!user || !user.familyId) {
      return [];
    }

    const term = args.searchTerm.toLowerCase();

    // Get user's files based on role
    let myFiles;
    if (user.role === "owner") {
      // Owner sees all family files
      myFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
        .collect();
    } else {
      // Member sees assigned files + unassigned family files
      const allFamilyFiles = await ctx.db
        .query("files")
        .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
        .collect();
      myFiles = allFamilyFiles.filter(
        (f) => f.assignedTo === user._id || !f.assignedTo
      );
    }

    // Get all folders for folder name lookup
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
      .collect();
    const folderMap = new Map(folders.map((f) => [f._id, f.name]));

    // Get all family members for assignee name lookup
    const members = await ctx.db
      .query("users")
      .withIndex("by_family", (q) => q.eq("familyId", user.familyId!))
      .collect();
    const memberMap = new Map(members.map((m) => [m._id, m.name]));

    // Filter by search term (name, tags, folder name, or assignee name)
    const matchingFiles = myFiles.filter((file) => {
      // Match file name
      if (file.name.toLowerCase().includes(term)) return true;
      // Match tags
      if (file.tags?.some((tag) => tag.toLowerCase().includes(term)))
        return true;
      // Match folder name
      if (file.folderId) {
        const folderName = folderMap.get(file.folderId);
        if (folderName?.toLowerCase().includes(term)) return true;
      }
      // Match assignee name
      if (file.assignedTo) {
        const assigneeName = memberMap.get(file.assignedTo);
        if (assigneeName?.toLowerCase().includes(term)) return true;
      }
      return false;
    });

    // Enrich with folder and assignee names and sort alphabetically
    return matchingFiles
      .map((file) => ({
        ...file,
        folderName: file.folderId ? folderMap.get(file.folderId) : undefined,
        assigneeName: file.assignedTo ? memberMap.get(file.assignedTo) : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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

// Move file to a different folder - OWNER ONLY
export const moveFile = mutation({
  args: {
    fileId: v.id("files"),
    folderId: v.optional(v.id("folders")),
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

    // Only owner can move files
    if (user.role !== "owner" || file.uploadedBy !== user._id) {
      throw new Error("Not authorized to move this file");
    }

    // Validate target folder if provided
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.familyId !== file.familyId) {
        throw new Error("Target folder not found");
      }
    }

    await ctx.db.patch(args.fileId, { folderId: args.folderId });
  },
});

// Bulk delete files - OWNER ONLY
export const bulkDeleteFiles = mutation({
  args: {
    fileIds: v.array(v.id("files")),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("bulkDeleteFiles called with:", args.fileIds.length, "files");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    console.log("Found user:", user?._id, "role:", user?.role);

    if (!user || user.role !== "owner") {
      throw new Error("Only owners can delete files");
    }

    const fileKeys: string[] = [];

    for (const fileId of args.fileIds) {
      const file = await ctx.db.get(fileId);
      console.log("Processing file:", fileId, "found:", !!file, "uploadedBy:", file?.uploadedBy);
      if (file && file.uploadedBy === user._id) {
        fileKeys.push(file.fileKey);
        await ctx.db.delete(fileId);
        console.log("Deleted file:", fileId);
      }
    }

    console.log("bulkDeleteFiles completed, deleted:", fileKeys.length);
    return { fileKeys };
  },
});

// Bulk move files to folder - OWNER ONLY
export const bulkMoveFiles = mutation({
  args: {
    fileIds: v.array(v.id("files")),
    folderId: v.optional(v.id("folders")),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("bulkMoveFiles called with:", args.fileIds.length, "files, target folder:", args.folderId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    console.log("Found user:", user?._id, "role:", user?.role);

    if (!user || user.role !== "owner") {
      throw new Error("Only owners can move files");
    }

    // Validate target folder if provided
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.familyId !== user.familyId) {
        throw new Error("Target folder not found");
      }
    }

    for (const fileId of args.fileIds) {
      const file = await ctx.db.get(fileId);
      console.log("Processing file:", fileId, "found:", !!file);
      if (file && file.uploadedBy === user._id) {
        await ctx.db.patch(fileId, { folderId: args.folderId });
        console.log("Moved file:", fileId);
      }
    }
    console.log("bulkMoveFiles completed");
  },
});

// Bulk assign files to member - OWNER ONLY
export const bulkAssignFiles = mutation({
  args: {
    fileIds: v.array(v.id("files")),
    assignedTo: v.optional(v.id("users")),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("bulkAssignFiles called with:", {
        fileIds: args.fileIds,
        assignedTo: args.assignedTo,
        clerkId: args.clerkId,
      });

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
        .unique();

      console.log("Found user:", user?._id, "role:", user?.role);

      if (!user || user.role !== "owner") {
        throw new Error("Only owners can assign files");
      }

      for (const fileId of args.fileIds) {
        const file = await ctx.db.get(fileId);
        console.log("Processing file:", fileId, "found:", !!file, "uploadedBy:", file?.uploadedBy, "user._id:", user._id);
        if (file && file.uploadedBy === user._id) {
          console.log("Patching file with assignedTo:", args.assignedTo);
          await ctx.db.patch(fileId, { assignedTo: args.assignedTo });
          console.log("File patched successfully");
        }
      }
      console.log("bulkAssignFiles completed");
    } catch (error) {
      console.error("bulkAssignFiles error:", error);
      throw error;
    }
  },
});
