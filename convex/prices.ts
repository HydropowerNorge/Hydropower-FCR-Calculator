import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";

const DEFAULT_AREA = "NO1";

function resolveArea(area: string | undefined): string {
  return area ?? DEFAULT_AREA;
}

function mapPriceRow(row: {
  timestamp: number;
  hourNumber: number;
  priceEurMw: number;
  volumeMw: number;
}) {
  return {
    timestamp: row.timestamp,
    hourNumber: row.hourNumber,
    priceEurMw: row.priceEurMw,
    volumeMw: row.volumeMw,
  };
}

export const getAvailableYears = query({
  args: {
    area: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const area = resolveArea(args.area);
    const rows = await ctx.db
      .query("fcrPrices")
      .withIndex("by_area_timestamp", (q) => q.eq("area", area))
      .collect();

    const years = new Set<number>();
    for (const row of rows) {
      years.add(row.year);
    }

    return Array.from(years).sort((a, b) => a - b);
  },
});

export const getPriceDataPage = query({
  args: {
    year: v.number(),
    area: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const area = resolveArea(args.area);

    const page = await ctx.db
      .query("fcrPrices")
      .withIndex("by_year_area_timestamp", (q) =>
        q.eq("year", args.year).eq("area", area),
      )
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((row) => mapPriceRow(row)),
    };
  },
});
