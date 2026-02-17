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

const solarRowValidator = v.object({
  year: v.number(),
  resolutionMinutes: v.number(),
  timestamp: v.number(),
  production: v.number(),
});

const solarSeriesValidator = v.object({
  year: v.number(),
  resolutionMinutes: v.number(),
  sampleCount: v.number(),
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

export const clearSolarSeries = mutation({
  args: {
    year: v.number(),
    resolutionMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("solarProduction")
      .withIndex("by_year_resolution_timestamp", (q) =>
        q.eq("year", args.year).eq("resolutionMinutes", args.resolutionMinutes),
      )
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const clearSolarSeriesMeta = mutation({
  args: {
    year: v.number(),
    resolutionMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("solarSeries")
      .withIndex("by_resolution_year", (q) =>
        q.eq("resolutionMinutes", args.resolutionMinutes).eq("year", args.year),
      )
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const setSolarSeriesMeta = mutation({
  args: {
    series: solarSeriesValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("solarSeries")
      .withIndex("by_resolution_year", (q) =>
        q
          .eq("resolutionMinutes", args.series.resolutionMinutes)
          .eq("year", args.series.year),
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        sampleCount: args.series.sampleCount,
      });
      return { updated: 1 };
    }

    await ctx.db.insert("solarSeries", args.series);
    return { inserted: 1 };
  },
});

export const insertSolarRows = mutation({
  args: {
    rows: v.array(solarRowValidator),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > MAX_ROWS_PER_MUTATION) {
      throw new Error(
        `insertSolarRows accepts up to ${MAX_ROWS_PER_MUTATION} rows per call`,
      );
    }

    for (const row of args.rows) {
      await ctx.db.insert("solarProduction", row);
    }

    return {
      inserted: args.rows.length,
    };
  },
});
