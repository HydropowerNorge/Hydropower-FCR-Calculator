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
    const years: number[] = [];

    // Probe candidate years (2020–2030) using the indexed query so we
    // only read 1 row per year instead of scanning the entire table.
    for (let y = 2020; y <= 2030; y++) {
      const row = await ctx.db
        .query("fcrPrices")
        .withIndex("by_year_area_timestamp", (q) =>
          q.eq("year", y).eq("area", area),
        )
        .first();
      if (row) years.push(y);
    }

    return years;
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
