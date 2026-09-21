import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { Page } from "../models/page.model.js";
import { ENV } from "../config/env.js";

export async function getSitemap(req, res) {
  try {
    const BASE = ENV.CLIENT_URL || "https://primexpc.com";

    const [products, categories, pages] = await Promise.all([
      Product.find({}).select("_id updatedAt name").lean(),
      Category.find({}).select("name updatedAt").lean(),
      Page.find({ active: true }).select("slug updatedAt").lean(),
    ]);

    const urls = [];

    urls.push({ loc: `${BASE}/`, priority: "1.0", changefreq: "daily" });
    urls.push({ loc: `${BASE}/categories`, priority: "0.9", changefreq: "weekly" });
    urls.push({ loc: `${BASE}/contact`, priority: "0.5", changefreq: "monthly" });
    urls.push({ loc: `${BASE}/sell`, priority: "0.6", changefreq: "weekly" });
    urls.push({ loc: `${BASE}/cart`, priority: "0.3", changefreq: "weekly" });
    urls.push({ loc: `${BASE}/sitemap`, priority: "0.2", changefreq: "monthly" });

    for (const p of products) {
      urls.push({
        loc: `${BASE}/product/${p._id}`,
        lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : null,
        priority: "0.7",
        changefreq: "weekly",
      });
    }

    for (const c of categories) {
      urls.push({
        loc: `${BASE}/category/${encodeURIComponent(c.name)}`,
        lastmod: c.updatedAt ? new Date(c.updatedAt).toISOString().split("T")[0] : null,
        priority: "0.6",
        changefreq: "weekly",
      });
    }

    for (const pg of pages) {
      urls.push({
        loc: `${BASE}/page/${pg.slug}`,
        lastmod: pg.updatedAt ? new Date(pg.updatedAt).toISOString().split("T")[0] : null,
        priority: "0.5",
        changefreq: "monthly",
      });
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const u of urls) {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(u.loc)}</loc>\n`;
      if (u.lastmod) xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate sitemap" });
  }
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
