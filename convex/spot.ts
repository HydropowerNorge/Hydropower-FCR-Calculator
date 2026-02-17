import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";

const DEFAULT_BIDDING_ZONE = "NO1";

export const getSpotDataPage = query({
  args: {
    biddingZone: v.optional(v.string()),
    year: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const biddingZone = args.biddingZone ?? DEFAULT_BIDDING_ZONE;
    const year = Number.isInteger(args.year) ? Number(args.year) : null;

    const page = await ctx.db
      .query("spotPrices")
      .withIndex("by_zone_timestamp", (q) => {
        const byZone = q.eq("biddingZone", biddingZone);
        if (year === null) {
          return byZone;
        }

        const startTs = Date.UTC(year, 0, 1, 0, 0, 0, 0);
        const endTs = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0);
        return byZone.gte("timestamp", startTs).lt("timestamp", endTs);
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
