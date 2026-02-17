import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";

const DEFAULT_BIDDING_ZONE = "NO1";

function resolveBiddingZone(biddingZone: string | undefined): string {
  return biddingZone ?? DEFAULT_BIDDING_ZONE;
}

function normalizeYear(year: number | undefined): number | null {
  return Number.isInteger(year) ? Number(year) : null;
}

function getYearRange(year: number | null): { startTs: number; endTs: number } | null {
  if (year === null) {
    return null;
  }

  return {
    startTs: Date.UTC(year, 0, 1, 0, 0, 0, 0),
    endTs: Date.UTC(year + 1, 0, 1, 0, 0, 0, 0),
  };
}

export const getSpotDataPage = query({
  args: {
    biddingZone: v.optional(v.string()),
    year: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const biddingZone = resolveBiddingZone(args.biddingZone);
    const year = normalizeYear(args.year);

    const page = await ctx.db
      .query("spotPrices")
      .withIndex("by_zone_timestamp", (q) => {
        const byZone = q.eq("biddingZone", biddingZone);
        const yearRange = getYearRange(year);
        if (yearRange === null) {
          return byZone;
        }

        return byZone.gte("timestamp", yearRange.startTs).lt("timestamp", yearRange.endTs);
      })
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((row) => ({
        timestamp: row.timestamp,
        spotPriceEurMwh: row.spotPriceEurMwh,
      })),
    };
  },
});
