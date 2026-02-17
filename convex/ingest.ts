import { v } from "convex/values";
import { mutation } from "./_generated/server";

const MAX_ROWS_PER_MUTATION = 1000;
const DELETE_BATCH_SIZE = 500;

const priceRowValidator = v.object({
  year: v.number(),
  area: v.string(),
  timestamp: v.number(),
  hourNumber: v.number(),
  priceEurMw: v.number(),
  volumeMw: v.number(),
});

const spotRowValidator = v.object({
  biddingZone: v.string(),
  timestamp: v.number(),
  spotPriceEurMwh: v.number(),
});

export const clearPriceYear = mutation({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("fcrPrices")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const insertPriceRows = mutation({
  args: {
    rows: v.array(priceRowValidator),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > MAX_ROWS_PER_MUTATION) {
      throw new Error(
        `insertPriceRows accepts up to ${MAX_ROWS_PER_MUTATION} rows per call`,
      );
    }

    for (const row of args.rows) {
      await ctx.db.insert("fcrPrices", row);
    }

    return {
      inserted: args.rows.length,
    };
  },
});

export const clearSpotZone = mutation({
  args: {
    biddingZone: v.string(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("spotPrices")
      .withIndex("by_zone_timestamp", (q) => q.eq("biddingZone", args.biddingZone))
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const insertSpotRows = mutation({
  args: {
    rows: v.array(spotRowValidator),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > MAX_ROWS_PER_MUTATION) {
      throw new Error(
        `insertSpotRows accepts up to ${MAX_ROWS_PER_MUTATION} rows per call`,
      );
    }

    for (const row of args.rows) {
      await ctx.db.insert("spotPrices", row);
    }

    return {
      inserted: args.rows.length,
    };
  },
});
