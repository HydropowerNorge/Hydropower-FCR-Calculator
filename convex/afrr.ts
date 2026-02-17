import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

const DEFAULT_ZONE = "NO1";
const DEFAULT_DIRECTION = "down";
const DEFAULT_RESERVE_TYPE = "afrr";
const DEFAULT_RESOLUTION_MIN = 60;

function normalizeString(value: string | undefined, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeResolutionMinutes(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : DEFAULT_RESOLUTION_MIN;
}

function normalizeAfrrFilters(args: {
  biddingZone?: string;
  direction?: string;
  reserveType?: string;
  resolutionMin?: number;
}) {
  return {
    biddingZone: normalizeString(args.biddingZone, DEFAULT_ZONE),
    direction: normalizeString(args.direction, DEFAULT_DIRECTION),
    reserveType: normalizeString(args.reserveType, DEFAULT_RESERVE_TYPE),
    resolutionMin: normalizeResolutionMinutes(args.resolutionMin),
  };
}

function mapAfrrMarketRow(row: {
  timestamp: number;
  biddingZone: string;
  direction: string;
  reserveType: string;
  resolutionMin: number;
  marketVolumeMw?: number | null;
  marketPriceEurMw?: number | null;
  marketActivatedVolumeMw?: number | null;
  marketGotActivated?: boolean | null;
  contractedQuantityMw?: number | null;
  contractedPriceEurMw?: number | null;
  activationPriceEurMwh?: number | null;
}) {
  return {
    timestamp: row.timestamp,
    biddingZone: row.biddingZone,
    direction: row.direction,
    reserveType: row.reserveType,
    resolutionMin: row.resolutionMin,
    marketVolumeMw: row.marketVolumeMw ?? null,
    marketPriceEurMw: row.marketPriceEurMw ?? null,
    marketActivatedVolumeMw: row.marketActivatedVolumeMw ?? null,
    marketGotActivated: row.marketGotActivated ?? null,
    contractedQuantityMw: row.contractedQuantityMw ?? null,
    contractedPriceEurMw: row.contractedPriceEurMw ?? null,
    activationPriceEurMwh: row.activationPriceEurMwh ?? null,
  };
}

export const getAvailableYears = query({
  args: {
    biddingZone: v.optional(v.string()),
    direction: v.optional(v.string()),
    reserveType: v.optional(v.string()),
    resolutionMin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { biddingZone, direction, reserveType, resolutionMin } = normalizeAfrrFilters(args);

    const seriesRows = await ctx.db
      .query("afrrSeries")
      .withIndex("by_filter_year", (q) =>
        q
          .eq("biddingZone", biddingZone)
          .eq("direction", direction)
          .eq("reserveType", reserveType)
          .eq("resolutionMin", resolutionMin),
      )
      .collect();

    if (seriesRows.length > 0) {
      return seriesRows.map((row) => row.year);
    }

    // Backward compatibility if afrrSeries metadata has not been seeded yet.
    const years: number[] = [];
    const thisYear = new Date().getUTCFullYear();
    const minYear = 2015;
    const maxYear = thisYear + 5;

    for (let year = minYear; year <= maxYear; year += 1) {
      const rows = await ctx.db
        .query("afrrMarket")
        .withIndex("by_year_zone_direction_type_resolution_timestamp", (q) =>
          q
            .eq("year", year)
            .eq("biddingZone", biddingZone)
            .eq("direction", direction)
            .eq("reserveType", reserveType)
            .eq("resolutionMin", resolutionMin),
        )
        .take(1);
      if (rows.length > 0) years.push(year);
    }

    return years;
  },
});

export const getAfrrDataPage = query({
  args: {
    year: v.number(),
    biddingZone: v.optional(v.string()),
    direction: v.optional(v.string()),
    reserveType: v.optional(v.string()),
    resolutionMin: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { biddingZone, direction, reserveType, resolutionMin } = normalizeAfrrFilters(args);

    const page = await ctx.db
      .query("afrrMarket")
      .withIndex("by_year_zone_direction_type_resolution_timestamp", (q) =>
        q
          .eq("year", args.year)
          .eq("biddingZone", biddingZone)
          .eq("direction", direction)
          .eq("reserveType", reserveType)
          .eq("resolutionMin", resolutionMin),
      )
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((row) => mapAfrrMarketRow(row)),
    };
  },
});
