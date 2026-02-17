import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";

function toSortedUnique(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

// Resolution must always be explicit (e.g. 60 or 15) to avoid mixing time series.
export const getAvailableResolutions = query({
  args: {},
  handler: async (ctx) => {
    const seriesRows = await ctx.db
      .query("solarSeries")
      .withIndex("by_resolution_year")
      .collect();

    const resolutions = seriesRows.map((row) => row.resolutionMinutes);

    if (resolutions.length > 0) {
      return toSortedUnique(resolutions);
    }

    // Backward compatibility when metadata has not been populated yet.
    const rows = await ctx.db
      .query("solarProduction")
      .withIndex("by_resolution_year_timestamp")
      .collect();

    return toSortedUnique(rows.map((row) => row.resolutionMinutes));
  },
});

export const getAvailableYears = query({
  args: {
    resolutionMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const seriesRows = await ctx.db
      .query("solarSeries")
      .withIndex("by_resolution_year", (q) =>
        q.eq("resolutionMinutes", args.resolutionMinutes),
      )
      .collect();

    if (seriesRows.length > 0) {
      return seriesRows.map((row) => row.year);
    }

    // Backward compatibility when metadata has not been populated yet.
    const rows = await ctx.db
      .query("solarProduction")
      .withIndex("by_resolution_year_timestamp", (q) =>
        q.eq("resolutionMinutes", args.resolutionMinutes),
      )
      .collect();

    return toSortedUnique(rows.map((row) => row.year));
  },
});

export const getSolarDataPage = query({
  args: {
    year: v.number(),
    resolutionMinutes: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("solarProduction")
      .withIndex("by_year_resolution_timestamp", (q) =>
        q.eq("year", args.year).eq("resolutionMinutes", args.resolutionMinutes),
      )
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((row) => ({
        timestamp: row.timestamp,
        production: row.production,
        resolutionMinutes: row.resolutionMinutes,
      })),
    };
  },
});
