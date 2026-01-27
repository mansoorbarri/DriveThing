import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get or create user from Clerk data
export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      // Update user info if changed
      if (
        existing.email !== args.email ||
        existing.name !== args.name ||
        existing.imageUrl !== args.imageUrl
      ) {
        await ctx.db.patch(existing._id, {
          email: args.email,
          name: args.name,
          imageUrl: args.imageUrl,
        });
      }
      return existing._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      createdAt: Date.now(),
    });
  },
});

// Get current user by Clerk ID
export const getCurrentUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get user with their family info
export const getUserWithFamily = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user || !user.familyId) {
      return { user, family: null, members: [] };
    }

    const family = await ctx.db.get(user.familyId);
    const members = await ctx.db
      .query("users")
      .withIndex("by_family", (q) => q.eq("familyId", user.familyId))
      .collect();

    return { user, family, members };
  },
});
