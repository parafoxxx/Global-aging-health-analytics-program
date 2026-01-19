import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),
  
  countries: defineTable({
    country: v.string(),
    total_count: v.number(),
    frail_count: v.number(),
    non_frail_count: v.number(),
    frail_percentage: v.number(),
    avg_age: v.number(),
    female_count: v.number(),
    male_count: v.number(),
    female_percentage: v.number(),
    male_percentage: v.number(),
    comorbidity_yes: v.number(),
    comorbidity_no: v.number(),
    comorbidity_percentage: v.number(),
    age_groups: v.record(v.string(), v.number()),
    health_ratings: v.record(v.string(), v.number()),
    marital_status: v.record(v.string(), v.number()),
    marriage_age_categories: v.record(v.string(), v.number()),
  }).index("by_country", ["country"]),
});
