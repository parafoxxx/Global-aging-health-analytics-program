"use node";

import { action } from "./_generated/server";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function parseRss(xml: string): NewsItem[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];
  return items
    .map((item) => {
      const title = extractTag(item, "title");
      const link = extractTag(item, "link");
      const publishedAt = extractTag(item, "pubDate");
      const source = extractTag(item, "source") || "Google News";
      return { title, link, source, publishedAt };
    })
    .filter((item) => item.title && item.link);
}

export const getLatestNews = action({
  args: {},
  handler: async () => {
    const query = encodeURIComponent("aging health frailty");
    const feedUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "GAHASP-News-Fetcher/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch news feed (${response.status})`);
    }

    const xml = await response.text();
    const parsed = parseRss(xml).slice(0, 9);
    return parsed;
  },
});
