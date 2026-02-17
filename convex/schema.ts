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
});
