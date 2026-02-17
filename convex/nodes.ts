import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

const DEFAULT_DATASET = "nodes_2026_pilot";

function normalizeFilter(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapNodeTenderRow(row: any) {
  return {
    dataset: row.dataset,
    tenderId: row.tenderId,
    name: row.name,
    status: row.status,
    quantityType: row.quantityType,
    quantityMw: row.quantityMw,
    regulationType: row.regulationType,
    activationType: row.activationType,
    peakReductionTargetMw: row.peakReductionTargetMw,
    availabilityPriceNokMwH: row.availabilityPriceNokMwH,
    reservationPriceNokMwH: row.reservationPriceNokMwH,
    activationPriceNokMwH: row.activationPriceNokMwH,
    marketTimeZone: row.marketTimeZone,
    activationDeadlineLocal: row.activationDeadlineLocal,
    activationNoticeDays: row.activationNoticeDays,
    gridNode: row.gridNode,
    gridNodeId: row.gridNodeId,
    market: row.market,
    marketId: row.marketId,
    organization: row.organization,
    organizationId: row.organizationId,
    periodStartTs: row.periodStartTs,
    periodEndTs: row.periodEndTs,
    openFromTs: row.openFromTs,
    toFromTs: row.toFromTs,
    activeDays: row.activeDays,
    activeWindows: row.activeWindows,
    exceptions: row.exceptions,
    comments: row.comments,
    source: row.source,
    createdAtTs: row.createdAtTs,
  };
}

export const getNodeTendersPage = query({
  args: {
    dataset: v.optional(v.string()),
    gridNode: v.optional(v.string()),
    market: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const dataset = normalizeFilter(args.dataset) ?? DEFAULT_DATASET;
    const gridNode = normalizeFilter(args.gridNode);
    const market = normalizeFilter(args.market);

    let page;
    if (gridNode && market) {
      page = await ctx.db
        .query("nodeTenders")
        .withIndex("by_dataset_gridNode_market_period", (q) =>
          q.eq("dataset", dataset).eq("gridNode", gridNode).eq("market", market),
        )
        .paginate(args.paginationOpts);
    } else if (gridNode) {
      page = await ctx.db
        .query("nodeTenders")
        .withIndex("by_dataset_gridNode_period", (q) =>
          q.eq("dataset", dataset).eq("gridNode", gridNode),
        )
        .paginate(args.paginationOpts);
    } else if (market) {
      page = await ctx.db
        .query("nodeTenders")
        .withIndex("by_dataset_market_period", (q) =>
          q.eq("dataset", dataset).eq("market", market),
        )
        .paginate(args.paginationOpts);
    } else {
      page = await ctx.db
        .query("nodeTenders")
        .withIndex("by_dataset_period", (q) => q.eq("dataset", dataset))
        .paginate(args.paginationOpts);
    }

    return {
      ...page,
      page: page.page.map((row) => mapNodeTenderRow(row)),
    };
  },
});

export const getNodeFilterOptions = query({
  args: {
    dataset: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dataset = normalizeFilter(args.dataset) ?? DEFAULT_DATASET;
    const rows = await ctx.db
      .query("nodeTenders")
      .withIndex("by_dataset_period", (q) => q.eq("dataset", dataset))
      .collect();

    const gridNodes = new Set<string>();
    const markets = new Set<string>();
    const statuses = new Set<string>();

    for (const row of rows) {
      gridNodes.add(row.gridNode);
      markets.add(row.market);
      statuses.add(row.status);
    }

    return {
      gridNodes: Array.from(gridNodes).sort((a, b) => a.localeCompare(b)),
      markets: Array.from(markets).sort((a, b) => a.localeCompare(b)),
      statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b)),
      total: rows.length,
    };
  },
});
