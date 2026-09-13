import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getAuthUserId,
  retrieveAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";

/**
 * Owner self-service account management: contact details, email (which is also
 * the sign-in ID) and password.
 *
 * Sign-in is always email + password [scott, 2026-09-13]. That makes the email
 * address a credential, not just a contact field, so changing it has to move
 * the auth account row as well as the profile — otherwise the owner updates
 * their email and can no longer log in. Both the email and password changes
 * therefore require the current password.
 */

const PASSWORD_MIN = 10; // Must match validatePasswordRequirements in auth.ts.

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function ownerProfileFor(ctx: any, userId: any) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
  if (!profile || profile.role !== "owner") {
    throw new Error("Not signed in as an owner.");
  }
  return profile;
}

/** Contact details for the signed-in owner. */
export const getAccount = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      email: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      phone: v.optional(v.string()),
      homeAddress: v.optional(v.string()),
      homeCity: v.optional(v.string()),
      homeState: v.optional(v.string()),
      homePostalCode: v.optional(v.string()),
      homeCountry: v.optional(v.string()),
      avatarUrl: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();
    if (!profile || profile.role !== "owner") return null;
    return {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      homeAddress: profile.homeAddress,
      homeCity: profile.homeCity,
      homeState: profile.homeState,
      homePostalCode: profile.homePostalCode,
      homeCountry: profile.homeCountry,
      avatarUrl: profile.avatarStorageId
        ? await ctx.storage.getUrl(profile.avatarStorageId)
        : null,
    };
  },
});

/**
 * Update contact details. Deliberately excludes email — that runs through
 * changeEmail because it is also the sign-in credential.
 */
export const updateContact = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    homeState: v.optional(v.string()),
    homePostalCode: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const profile = await ownerProfileFor(ctx, userId);

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName || !lastName) {
      throw new Error("First and last name are both required.");
    }

    await ctx.db.patch(profile._id, {
      firstName,
      lastName,
      // Keep the name shown in the header and on listing cards in step with
      // the contact details, rather than letting them drift apart.
      displayName: `${firstName} ${lastName}`,
      phone: args.phone?.trim() || undefined,
      homeAddress: args.homeAddress?.trim() || undefined,
      homeCity: args.homeCity?.trim() || undefined,
      homeState: args.homeState?.trim() || undefined,
      homePostalCode: args.homePostalCode?.trim() || undefined,
      homeCountry: args.homeCountry?.trim() || undefined,
    });
    return null;
  },
});

/** Internal: the signed-in owner's email, needed by actions to verify credentials. */
export const ownerEmail = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();
    if (!profile || profile.role !== "owner") return null;
    return profile.email ?? null;
  },
});

/** Internal: is this email already taken by a different account? */
export const emailTaken = internalQuery({
  args: { email: v.string(), exceptUserId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { email, exceptUserId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first();
    if (profile && String(profile.userId) !== String(exceptUserId)) return true;
    for (const a of await ctx.db.query("authAccounts").collect()) {
      const acct = a as any;
      if (
        acct.provider === "password" &&
        normalizeEmail(String(acct.providerAccountId ?? "")) === email &&
        String(acct.userId) !== String(exceptUserId)
      ) {
        return true;
      }
    }
    return false;
  },
});

/**
 * Internal: move the email across every record that stores it. The auth
 * account row is the one that actually matters for sign-in; missing it would
 * leave the owner unable to log in with their new address.
 */
export const applyEmailChange = internalMutation({
  args: { userId: v.id("users"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, email }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();
    if (profile) await ctx.db.patch(profile._id, { email });

    const user = await ctx.db.get(userId);
    if (user) await ctx.db.patch(userId, { email } as any);

    for (const a of await ctx.db.query("authAccounts").collect()) {
      const acct = a as any;
      if (acct.provider === "password" && String(acct.userId) === String(userId)) {
        await ctx.db.patch(a._id, { providerAccountId: email } as any);
      }
    }
    return null;
  },
});

/** Change the sign-in email. Requires the current password. */
export const changeEmail = action({
  args: { newEmail: v.string(), currentPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");

    const currentEmail = await ctx.runQuery(internal.ownerAccount.ownerEmail, {
      userId,
    });
    if (!currentEmail) throw new Error("Not signed in as an owner.");

    const newEmail = normalizeEmail(args.newEmail);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      throw new Error("That does not look like a valid email address.");
    }
    if (newEmail === normalizeEmail(currentEmail)) {
      throw new Error("That is already your email address.");
    }

    // Verify the current password before moving a credential.
    const existing = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: normalizeEmail(currentEmail), secret: args.currentPassword },
    }).catch(() => null);
    if (!existing) throw new Error("That password is not correct.");

    const taken = await ctx.runQuery(internal.ownerAccount.emailTaken, {
      email: newEmail,
      exceptUserId: userId,
    });
    if (taken) {
      throw new Error("An account already uses that email address.");
    }

    await ctx.runMutation(internal.ownerAccount.applyEmailChange, {
      userId,
      email: newEmail,
    });
    return null;
  },
});

/** Change the password. Requires the current one. */
export const changePassword = action({
  args: { currentPassword: v.string(), newPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");

    const email = await ctx.runQuery(internal.ownerAccount.ownerEmail, {
      userId,
    });
    if (!email) throw new Error("Not signed in as an owner.");

    if (args.newPassword.length < PASSWORD_MIN) {
      throw new Error(`Password must be at least ${PASSWORD_MIN} characters.`);
    }
    if (args.newPassword === args.currentPassword) {
      throw new Error("The new password matches your current one.");
    }

    const existing = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: normalizeEmail(email), secret: args.currentPassword },
    }).catch(() => null);
    if (!existing) throw new Error("That password is not correct.");

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: normalizeEmail(email), secret: args.newPassword },
    });
    return null;
  },
});

/** Upload URL for an owner's avatar photo. */
export const generateAvatarUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    await ownerProfileFor(ctx, userId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Attach an uploaded photo as the owner's avatar, replacing the initial.
 * Passing null clears it and falls back to the initial.
 */
export const setAvatar = mutation({
  args: { storageId: v.union(v.null(), v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const profile = await ownerProfileFor(ctx, userId);

    // Drop the previous file rather than orphaning it in storage.
    const previous = profile.avatarStorageId;
    await ctx.db.patch(profile._id, {
      avatarStorageId: storageId ?? undefined,
    });
    if (previous && String(previous) !== String(storageId)) {
      await ctx.storage.delete(previous).catch(() => {});
    }
    return null;
  },
});
