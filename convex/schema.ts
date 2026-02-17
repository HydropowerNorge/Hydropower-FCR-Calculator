import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  fcrPrices: defineTable({
    year: v.number(),
    area: v.string(),
    timestamp: v.number(),
    hourNumber: v.number(),
    priceEurMw: v.number(),
    volumeMw: v.number(),
  })
    .index("by_year", ["year"])
    .index("by_area_timestamp", ["area", "timestamp"])
    .index("by_year_area_timestamp", ["year", "area", "timestamp"]),

  spotPrices: defineTable({
    biddingZone: v.string(),
    timestamp: v.number(),
    spotPriceEurMwh: v.number(),
  }).index("by_zone_timestamp", ["biddingZone", "timestamp"]),

  solarProduction: defineTable({
    year: v.number(),
    // Partition key to keep hourly and quarter-hourly series strictly separate.
    resolutionMinutes: v.number(),
    timestamp: v.number(),
    production: v.number(),
  })
    .index("by_year_resolution_timestamp", ["year", "resolutionMinutes", "timestamp"])
    .index("by_resolution_year_timestamp", ["resolutionMinutes", "year", "timestamp"]),

  solarSeries: defineTable({
    year: v.number(),
    resolutionMinutes: v.number(),
    sampleCount: v.number(),
  }).index("by_resolution_year", ["resolutionMinutes", "year"]),

  nodeTenders: defineTable({
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
  })
    .index("by_dataset_tenderId", ["dataset", "tenderId"])
    .index("by_dataset_period", ["dataset", "periodStartTs"])
    .index("by_dataset_gridNode_period", ["dataset", "gridNode", "periodStartTs"])
    .index("by_dataset_market_period", ["dataset", "market", "periodStartTs"])
    .index("by_dataset_gridNode_market_period", [
      "dataset",
      "gridNode",
      "market",
      "periodStartTs",
    ]),
});
