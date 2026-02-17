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

const afrrRowValidator = v.object({
  year: v.number(),
  timestamp: v.number(),
  biddingZone: v.string(),
  direction: v.string(),
  reserveType: v.string(),
  resolutionMin: v.number(),
  marketVolumeMw: v.optional(v.number()),
  marketPriceEurMw: v.optional(v.number()),
  marketActivatedVolumeMw: v.optional(v.number()),
  marketGotActivated: v.optional(v.boolean()),
  contractedQuantityMw: v.optional(v.number()),
  contractedPriceEurMw: v.optional(v.number()),
  activationPriceEurMwh: v.optional(v.number()),
  source: v.string(),
});

const afrrSeriesValidator = v.object({
  year: v.number(),
  biddingZone: v.string(),
  direction: v.string(),
  reserveType: v.string(),
  resolutionMin: v.number(),
  sampleCount: v.number(),
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

const nodeTenderValidator = v.object({
  dataset: v.string(),
  tenderId: v.string(),
  name: v.string(),
  status: v.string(),
  quantityType: v.string(),
  quantityMw: v.number(),
  regulationType: v.optional(v.string()),
  activationType: v.optional(v.string()),
  peakReductionTargetMw: v.optional(v.number()),
  availabilityPriceNokMwH: v.optional(v.number()),
  reservationPriceNokMwH: v.optional(v.number()),
  activationPriceNokMwH: v.optional(v.number()),
  marketTimeZone: v.string(),
  activationDeadlineLocal: v.optional(v.string()),
  activationNoticeDays: v.optional(v.number()),
  gridNode: v.string(),
  gridNodeId: v.optional(v.string()),
  market: v.string(),
  marketId: v.optional(v.string()),
  organization: v.optional(v.string()),
  organizationId: v.optional(v.string()),
  periodStartTs: v.number(),
  periodEndTs: v.number(),
  openFromTs: v.optional(v.number()),
  toFromTs: v.optional(v.number()),
  activeDays: v.array(v.string()),
  activeWindows: v.array(
    v.object({
      start: v.string(),
      end: v.string(),
    }),
  ),
  exceptions: v.optional(v.string()),
  comments: v.optional(v.string()),
  source: v.string(),
  createdAtTs: v.number(),
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

export const clearAfrrYear = mutation({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("afrrMarket")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const clearAfrrSeriesYear = mutation({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("afrrSeries")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const setAfrrSeriesMeta = mutation({
  args: {
    series: afrrSeriesValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("afrrSeries")
      .withIndex("by_filter_year", (q) =>
        q
          .eq("biddingZone", args.series.biddingZone)
          .eq("direction", args.series.direction)
          .eq("reserveType", args.series.reserveType)
          .eq("resolutionMin", args.series.resolutionMin)
          .eq("year", args.series.year),
      )
      .take(1);

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        sampleCount: args.series.sampleCount,
      });
      return { updated: 1 };
    }

    await ctx.db.insert("afrrSeries", args.series);
    return { inserted: 1 };
  },
});

export const insertAfrrRows = mutation({
  args: {
    rows: v.array(afrrRowValidator),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > MAX_ROWS_PER_MUTATION) {
      throw new Error(
        `insertAfrrRows accepts up to ${MAX_ROWS_PER_MUTATION} rows per call`,
      );
    }

    for (const row of args.rows) {
      await ctx.db.insert("afrrMarket", row);
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

export const clearNodeTenderDataset = mutation({
  args: {
    dataset: v.string(),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("nodeTenders")
      .withIndex("by_dataset_period", (q) => q.eq("dataset", args.dataset))
      .take(DELETE_BATCH_SIZE);

    await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)));

    return {
      deleted: docs.length,
      done: docs.length < DELETE_BATCH_SIZE,
    };
  },
});

export const insertNodeTenderRows = mutation({
  args: {
    rows: v.array(nodeTenderValidator),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > MAX_ROWS_PER_MUTATION) {
      throw new Error(
        `insertNodeTenderRows accepts up to ${MAX_ROWS_PER_MUTATION} rows per call`,
      );
    }

    for (const row of args.rows) {
      await ctx.db.insert("nodeTenders", row);
    }

    return {
      inserted: args.rows.length,
    };
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
