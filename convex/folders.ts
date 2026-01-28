import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";

// Create a new folder - OWNER ONLY
export const createFolder = mutation({
  args: {
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
    assignedTo: v.optional(v.array(v.id("users"))),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      throw new Error("User must be in a family to create folders");
    }

    if (user.role !== "owner") {
      throw new Error("Only family owners can create folders");
    }

    // Validate parent folder exists and belongs to the same family
    if (args.parentFolderId) {
      const parentFolder = await ctx.db.get(args.parentFolderId);
      if (!parentFolder || parentFolder.familyId !== user.familyId) {
        throw new Error("Parent folder not found");
      }
    }

    // Only store non-empty arrays
    const assignedTo = args.assignedTo && args.assignedTo.length > 0 ? args.assignedTo : undefined;

    return await ctx.db.insert("folders", {
      name: args.name,
      parentFolderId: args.parentFolderId,
      createdBy: user._id,
      assignedTo,
      familyId: user.familyId,
      sharedWithFamily: false,
      sharedWith: [],
      createdAt: Date.now(),
    });
  },
});

// Rename a folder - OWNER ONLY
export const renameFolder = mutation({
  args: {
    folderId: v.id("folders"),
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

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (user.role !== "owner" || folder.createdBy !== user._id) {
      throw new Error("Not authorized to rename this folder");
    }

    await ctx.db.patch(args.folderId, { name: args.newName });
  },
});

// Delete a folder - OWNER ONLY
// Option to delete contents or move them to parent folder
export const deleteFolder = mutation({
  args: {
    folderId: v.id("folders"),
    deleteContents: v.boolean(),
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

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (user.role !== "owner" || folder.createdBy !== user._id) {
      throw new Error("Not authorized to delete this folder");
    }

    // Get all files in this folder
    const filesInFolder = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    // Get all subfolders
    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentFolderId", args.folderId))
      .collect();

    const fileKeysToDelete: string[] = [];

    if (args.deleteContents) {
      // Delete all files in this folder
      for (const file of filesInFolder) {
        fileKeysToDelete.push(file.fileKey);
        await ctx.db.delete(file._id);
      }

      // Recursively delete subfolders
      for (const subfolder of subfolders) {
        // Get files in subfolder
        const subfiles = await ctx.db
          .query("files")
          .withIndex("by_folder", (q) => q.eq("folderId", subfolder._id))
          .collect();
        for (const file of subfiles) {
          fileKeysToDelete.push(file.fileKey);
          await ctx.db.delete(file._id);
        }
        await ctx.db.delete(subfolder._id);
      }
    } else {
      // Move files to parent folder (or root if no parent)
      for (const file of filesInFolder) {
        await ctx.db.patch(file._id, { folderId: folder.parentFolderId });
      }

      // Move subfolders to parent folder
      for (const subfolder of subfolders) {
        await ctx.db.patch(subfolder._id, {
          parentFolderId: folder.parentFolderId,
        });
      }
    }

    // Delete the folder itself
    await ctx.db.delete(args.folderId);

    return { fileKeysToDelete };
  },
});

// Update folder assignment - OWNER ONLY
export const updateFolderAssignment = mutation({
  args: {
    folderId: v.id("folders"),
    assignedTo: v.optional(v.array(v.id("users"))),
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

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (user.role !== "owner" || folder.createdBy !== user._id) {
      throw new Error("Not authorized to update this folder");
    }

    // Only store non-empty arrays
    const assignedTo = args.assignedTo && args.assignedTo.length > 0 ? args.assignedTo : undefined;
    await ctx.db.patch(args.folderId, { assignedTo });
  },
});

// Update folder sharing - Owner or assigned member
export const updateFolderSharing = mutation({
  args: {
    folderId: v.id("folders"),
    shareWithFamily: v.boolean(),
    sharedWith: v.array(v.id("users")),
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

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Allow if user is owner OR folder is assigned to them
    const canShare =
      folder.createdBy === user._id || folder.assignedTo?.includes(user._id);

    if (!canShare) {
      throw new Error("Not authorized to share this folder");
    }

    await ctx.db.patch(args.folderId, {
      sharedWithFamily: args.shareWithFamily,
      sharedWith: args.sharedWith,
    });
  },
});

// Move folder to different parent - OWNER ONLY
export const moveFolder = mutation({
  args: {
    folderId: v.id("folders"),
    newParentFolderId: v.optional(v.id("folders")),
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

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (user.role !== "owner" || folder.createdBy !== user._id) {
      throw new Error("Not authorized to move this folder");
    }

    // Prevent moving a folder into itself or its descendants
    if (args.newParentFolderId) {
      let currentParent: Id<"folders"> | undefined = args.newParentFolderId;
      while (currentParent) {
        if (currentParent === args.folderId) {
          throw new Error("Cannot move a folder into itself or its descendants");
        }
        const parentFolder: Doc<"folders"> | null = await ctx.db.get(currentParent);
        currentParent = parentFolder?.parentFolderId;
      }

      // Verify new parent exists and belongs to the same family
      const newParent = await ctx.db.get(args.newParentFolderId);
      if (!newParent || newParent.familyId !== folder.familyId) {
        throw new Error("Target folder not found");
      }
    }

    await ctx.db.patch(args.folderId, {
      parentFolderId: args.newParentFolderId,
    });
  },
});

// Get folders visible to user (owned, assigned, or unassigned family folders)
export const getMyFolders = query({
  args: {
    clerkId: v.string(),
    parentFolderId: v.optional(v.id("folders")),
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

    // Get all folders in the family at this level
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentFolderId", args.parentFolderId))
      .collect();

    // Filter to folders in this family
    const familyFolders = allFolders.filter((f) => f.familyId === familyId);

    // Filter based on role
    let visibleFolders;
    if (user.role === "owner") {
      // Owner sees all folders they created
      visibleFolders = familyFolders.filter((f) => f.createdBy === user._id);
    } else {
      // Members see folders assigned to them + unassigned family folders
      visibleFolders = familyFolders.filter(
        (f) => f.assignedTo?.includes(user._id) || !f.assignedTo || f.assignedTo.length === 0
      );
    }

    // Get assignee info and item counts for each folder
    const foldersWithInfo = await Promise.all(
      visibleFolders.map(async (folder) => {
        let assigneeNames: string[] = [];
        if (folder.assignedTo && folder.assignedTo.length > 0) {
          const assignees = await Promise.all(
            folder.assignedTo.map((id) => ctx.db.get(id))
          );
          assigneeNames = assignees.filter(Boolean).map((a) => a!.name);
        }

        // Count items in folder
        const filesInFolder = await ctx.db
          .query("files")
          .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
          .collect();

        const subfoldersInFolder = await ctx.db
          .query("folders")
          .withIndex("by_parent", (q) => q.eq("parentFolderId", folder._id))
          .collect();

        return {
          ...folder,
          assigneeNames,
          itemCount: filesInFolder.length + subfoldersInFolder.length,
        };
      })
    );

    // Sort by name
    return foldersWithInfo.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get shared folders (folders shared with user)
export const getSharedFolders = query({
  args: {
    clerkId: v.string(),
    parentFolderId: v.optional(v.id("folders")),
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

    // Get all folders at this level
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentFolderId", args.parentFolderId))
      .collect();

    // Filter to folders in this family that are shared with user
    const sharedFolders = allFolders.filter((folder) => {
      if (folder.familyId !== familyId) return false;
      // Exclude folders created by this user (they see those in My Folders)
      if (folder.createdBy === user._id) return false;
      // Exclude folders assigned to this user (they see those in My Folders)
      if (folder.assignedTo?.includes(user._id)) return false;
      // Exclude unassigned folders (everyone sees those in My Folders)
      if (!folder.assignedTo || folder.assignedTo.length === 0) return false;
      // Include if shared with family
      if (folder.sharedWithFamily) return true;
      // Include if shared with this user specifically
      if (folder.sharedWith?.includes(user._id)) return true;
      return false;
    });

    // Get assignee info and item counts
    const foldersWithInfo = await Promise.all(
      sharedFolders.map(async (folder) => {
        let assigneeNames: string[] = [];
        if (folder.assignedTo && folder.assignedTo.length > 0) {
          const assignees = await Promise.all(
            folder.assignedTo.map((id) => ctx.db.get(id))
          );
          assigneeNames = assignees.filter(Boolean).map((a) => a!.name);
        }

        const creator = await ctx.db.get(folder.createdBy);

        // Count visible items
        const filesInFolder = await ctx.db
          .query("files")
          .withIndex("by_folder", (q) => q.eq("folderId", folder._id))
          .collect();

        const subfoldersInFolder = await ctx.db
          .query("folders")
          .withIndex("by_parent", (q) => q.eq("parentFolderId", folder._id))
          .collect();

        return {
          ...folder,
          assigneeNames,
          creatorName: creator?.name ?? "Unknown",
          itemCount: filesInFolder.length + subfoldersInFolder.length,
        };
      })
    );

    return foldersWithInfo.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get folder contents (files and subfolders)
export const getFolderContents = query({
  args: {
    folderId: v.id("folders"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return { folder: null, files: [], subfolders: [] };
    }

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.familyId !== user.familyId) {
      return { folder: null, files: [], subfolders: [] };
    }

    // Check access
    const canAccess =
      folder.createdBy === user._id ||
      folder.assignedTo?.includes(user._id) ||
      !folder.assignedTo ||
      folder.assignedTo.length === 0 ||
      folder.sharedWithFamily ||
      folder.sharedWith?.includes(user._id);

    if (!canAccess) {
      return { folder: null, files: [], subfolders: [] };
    }

    // Get files in this folder
    const files = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    const filesWithInfo = await Promise.all(
      files.map(async (file) => {
        let assigneeName: string | undefined;
        if (file.assignedTo) {
          const assignee = await ctx.db.get(file.assignedTo);
          assigneeName = assignee?.name;
        }
        return { ...file, assigneeName };
      })
    );

    // Get subfolders
    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentFolderId", args.folderId))
      .collect();

    const subfoldersWithInfo = await Promise.all(
      subfolders.map(async (subfolder) => {
        let assigneeNames: string[] = [];
        if (subfolder.assignedTo && subfolder.assignedTo.length > 0) {
          const assignees = await Promise.all(
            subfolder.assignedTo.map((id) => ctx.db.get(id))
          );
          assigneeNames = assignees.filter(Boolean).map((a) => a!.name);
        }

        // Count items
        const filesInFolder = await ctx.db
          .query("files")
          .withIndex("by_folder", (q) => q.eq("folderId", subfolder._id))
          .collect();

        const subfoldersInFolder = await ctx.db
          .query("folders")
          .withIndex("by_parent", (q) => q.eq("parentFolderId", subfolder._id))
          .collect();

        return {
          ...subfolder,
          assigneeNames,
          itemCount: filesInFolder.length + subfoldersInFolder.length,
        };
      })
    );

    let assigneeNames: string[] = [];
    if (folder.assignedTo && folder.assignedTo.length > 0) {
      const assignees = await Promise.all(
        folder.assignedTo.map((id) => ctx.db.get(id))
      );
      assigneeNames = assignees.filter(Boolean).map((a) => a!.name);
    }

    return {
      folder: { ...folder, assigneeNames },
      files: filesWithInfo.sort((a, b) => b.createdAt - a.createdAt),
      subfolders: subfoldersWithInfo.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

// Get folder path (breadcrumbs)
export const getFolderPath = query({
  args: {
    folderId: v.optional(v.id("folders")),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.folderId) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return [];
    }

    const path: Array<{ _id: Id<"folders">; name: string }> = [];
    let currentFolderId: Id<"folders"> | undefined = args.folderId;

    while (currentFolderId) {
      const folder: Doc<"folders"> | null = await ctx.db.get(currentFolderId);
      if (!folder || folder.familyId !== user.familyId) {
        break;
      }
      path.unshift({ _id: folder._id, name: folder.name });
      currentFolderId = folder.parentFolderId;
    }

    return path;
  },
});

// Get all folders for folder picker (tree structure)
export const getAllFoldersForPicker = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId || user.role !== "owner") {
      return [];
    }

    const familyId = user.familyId;

    // Get all folders created by this user
    const allFolders = await ctx.db
      .query("folders")
      .withIndex("by_family", (q) => q.eq("familyId", familyId))
      .collect();

    const myFolders = allFolders.filter((f) => f.createdBy === user._id);

    return myFolders.map((folder) => ({
      _id: folder._id,
      name: folder.name,
      parentFolderId: folder.parentFolderId,
      assignedTo: folder.assignedTo,
    }));
  },
});
