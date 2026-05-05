import type { MetadataRoute } from "next";

const siteUrl = "https://budget.amuharr.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/contact", "/privacy", "/terms"],
        disallow: ["/admin", "/api", "/auth", "/dashboard"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
