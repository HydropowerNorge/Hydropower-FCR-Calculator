import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";

const DEFAULT_BIDDING_ZONE = "NO1";

export const getSpotDataPage = query({
  args: {
    biddingZone: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const biddingZone = args.biddingZone ?? DEFAULT_BIDDING_ZONE;

    const page = await ctx.db
      .query("spotPrices")
      .withIndex("by_zone_timestamp", (q) => q.eq("biddingZone", biddingZone))
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
