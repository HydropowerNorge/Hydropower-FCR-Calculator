import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";

// Resolution must always be explicit (e.g. 60 or 15) to avoid mixing time series.
export const getAvailableResolutions = query({
  args: {},
  handler: async (ctx) => {
    const seriesRows = await ctx.db
      .query("solarSeries")
      .withIndex("by_resolution_year")
      .collect();

    const resolutions = new Set<number>();
    for (const row of seriesRows) {
      resolutions.add(row.resolutionMinutes);
    }

    if (resolutions.size > 0) {
      return Array.from(resolutions).sort((a, b) => a - b);
    }

    // Backward compatibility when metadata has not been populated yet.
    const rows = await ctx.db
      .query("solarProduction")
      .withIndex("by_resolution_year_timestamp")
      .collect();

    for (const row of rows) {
      resolutions.add(row.resolutionMinutes);
    }

    return Array.from(resolutions).sort((a, b) => a - b);
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

    const years = new Set<number>();
    for (const row of rows) {
      years.add(row.year);
    }

    return Array.from(years).sort((a, b) => a - b);
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
