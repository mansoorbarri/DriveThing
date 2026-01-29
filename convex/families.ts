import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a random invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Create a new family
export const createFamily = mutation({
  args: {
    name: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    if (user.familyId) {
      throw new Error("User already belongs to a family");
    }

    // Create the family
    const familyId = await ctx.db.insert("families", {
      name: args.name,
      ownerId: args.clerkId,
      inviteCode: generateInviteCode(),
      createdAt: Date.now(),
    });

    // Update user with family
    await ctx.db.patch(user._id, {
      familyId,
      role: "owner",
    });

    return familyId;
  },
});

// Join a family with invite code
export const joinFamily = mutation({
  args: {
    inviteCode: v.string(),
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

    if (user.familyId) {
      throw new Error("User already belongs to a family");
    }

    const family = await ctx.db
      .query("families")
      .withIndex("by_invite_code", (q) =>
        q.eq("inviteCode", args.inviteCode.toUpperCase())
      )
      .unique();

    if (!family) {
      throw new Error("Invalid invite code");
    }

    // Add user to family
    await ctx.db.patch(user._id, {
      familyId: family._id,
      role: "member",
    });

    return family._id;
  },
});

// Leave family (members only, not owner)
export const leaveFamily = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      throw new Error("User not in a family");
    }

    if (user.role === "owner") {
      throw new Error("Owner cannot leave. Transfer ownership or delete the family.");
    }

    await ctx.db.patch(user._id, {
      familyId: undefined,
      role: undefined,
    });
  },
});

// Regenerate invite code (owner only)
export const regenerateInviteCode = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId || user.role !== "owner") {
      throw new Error("Only family owner can regenerate invite code");
    }

    const newCode = generateInviteCode();
    await ctx.db.patch(user.familyId, { inviteCode: newCode });

    return newCode;
  },
});

// Get family by ID
export const getFamily = query({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.familyId);
  },
});

// Get family members
export const getFamilyMembers = query({
  args: { familyId: v.id("families") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("users")
      .withIndex("by_family", (q) => q.eq("familyId", args.familyId))
      .collect();

    // Sort: owner first, then alphabetically by name
    return members.sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

// Remove member from family (owner only)
export const removeMember = mutation({
  args: {
    clerkId: v.string(),
    memberUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!owner || owner.role !== "owner") {
      throw new Error("Only family owner can remove members");
    }

    const member = await ctx.db.get(args.memberUserId);
    if (!member || member.familyId !== owner.familyId) {
      throw new Error("Member not found in your family");
    }

    if (member.role === "owner") {
      throw new Error("Cannot remove the owner");
    }

    await ctx.db.patch(args.memberUserId, {
      familyId: undefined,
      role: undefined,
    });
  },
});
