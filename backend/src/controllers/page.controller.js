import { Page } from "../models/page.model.js";

export async function getPages(req, res) {
  try {
    const pages = await Page.find().sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json(pages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pages" });
  }
}

export async function getPublicPages(req, res) {
  try {
    const pages = await Page.find({ active: true }).sort({ sortOrder: 1, title: 1 }).select("title slug sortOrder");
    res.status(200).json(pages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pages" });
  }
}

export async function getPageBySlug(req, res) {
  try {
    const page = await Page.findOne({ slug: req.params.slug, active: true });
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.status(200).json(page);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch page" });
  }
}

export async function createPage(req, res) {
  try {
    const { title, slug, content, active, sortOrder } = req.body;
    const page = await Page.create({ title, slug, content, active, sortOrder: sortOrder || 0 });
    res.status(201).json(page);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Slug already exists" });
    res.status(500).json({ message: "Failed to create page" });
  }
}

export async function updatePage(req, res) {
  try {
    const { title, slug, content, active, sortOrder } = req.body;
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    if (title !== undefined) page.title = title;
    if (slug !== undefined) page.slug = slug;
    if (content !== undefined) page.content = content;
    if (active !== undefined) page.active = active;
    if (sortOrder !== undefined) page.sortOrder = sortOrder;
    await page.save();
    res.status(200).json(page);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Slug already exists" });
    res.status(500).json({ message: "Failed to update page" });
  }
}

export async function deletePage(req, res) {
  try {
    const page = await Page.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    res.status(200).json({ message: "Page deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete page" });
  }
}

export async function togglePageActive(req, res) {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) return res.status(404).json({ message: "Page not found" });
    page.active = !page.active;
    await page.save();
    res.status(200).json(page);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle page" });
  }
}
