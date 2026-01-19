import { query } from "./_generated/server";
import { v } from "convex/values";

export const getAllCountries = query({
  args: {},
  handler: async (ctx) => {
    const allCountries = await ctx.db.query("countries").collect();
    // Filter to only include new format countries (with health data)
    return allCountries.filter(c => c.country !== undefined);
  },
});

export const getCountryByName = query({
  args: { country: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("countries")
      .withIndex("by_country", (q) => q.eq("country", args.country))
      .first();
  },
});
