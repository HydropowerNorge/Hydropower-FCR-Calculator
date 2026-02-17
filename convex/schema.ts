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
});
