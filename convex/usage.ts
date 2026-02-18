import { v } from "convex/values";
import { mutation } from "./_generated/server";

const MIN_VALID_TIMESTAMP = 946684800000; // 2000-01-01T00:00:00.000Z

function normalizeHardwareId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("hardwareId must not be empty");
  }
  if (normalized.length > 128) {
    return normalized.slice(0, 128);
  }
  return normalized;
}

function normalizeTimestamp(value: number | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Date.now();
  const rounded = Math.round(numeric);
  if (rounded < MIN_VALID_TIMESTAMP) return Date.now();
  return rounded;
}

export const registerOpen = mutation({
  args: {
    hardwareId: v.string(),
    openedAtTs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hardwareId = normalizeHardwareId(args.hardwareId);
    const openedAtTs = normalizeTimestamp(args.openedAtTs);

    const existing = await ctx.db
      .query("appUsage")
      .withIndex("by_hardwareId", (q) => q.eq("hardwareId", hardwareId))
      .first();

    if (!existing) {
      const insertedId = await ctx.db.insert("appUsage", {
        hardwareId,
        firstOpenTs: openedAtTs,
        lastOpenTs: openedAtTs,
      });

      return {
        id: insertedId,
        hardwareId,
        firstOpenTs: openedAtTs,
        lastOpenTs: openedAtTs,
        isNew: true,
      };
    }

    const firstOpenTs = Math.min(existing.firstOpenTs, openedAtTs);
    const lastOpenTs = Math.max(existing.lastOpenTs, openedAtTs);

    if (firstOpenTs !== existing.firstOpenTs || lastOpenTs !== existing.lastOpenTs) {
      await ctx.db.patch(existing._id, {
        firstOpenTs,
        lastOpenTs,
      });
    }

    return {
      id: existing._id,
      hardwareId,
      firstOpenTs,
      lastOpenTs,
      isNew: false,
    };
  },
});
