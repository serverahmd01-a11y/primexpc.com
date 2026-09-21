import { Category } from "../models/category.model.js";

export async function getCategories(req, res) {
  try {
    const { condition } = req.query;
    const filter = {};
    if (condition) filter.condition = condition;
    const categories = await Category.find(filter).populate("parent", "name").sort({ name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    console.error("getCategories error:", error.message);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, parent, description, condition } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name required" });
    }

    const cond = condition || "new";
    const exists = await Category.findOne({ name: name.trim(), parent: parent || null, condition: cond });
    if (exists) return res.status(400).json({ error: "Category already exists under this condition" });

    const image = req.file ? `/uploads/${req.file.filename}` : "";

    const cat = await Category.create({ name: name.trim(), parent: parent || null, description: description || "", condition: cond, image });
    const populated = await Category.findById(cat._id).populate("parent", "name");
    res.status(201).json(populated);
  } catch (error) {
    console.error("createCategory error:", error.message, error);
    res.status(500).json({ error: "Failed to create category" });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    await Category.deleteMany({ parent: id });
    await Category.findByIdAndDelete(id);
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    console.error("deleteCategory error:", error.message);
    res.status(500).json({ error: "Failed to delete category" });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, parent, description, condition } = req.body;

    const existing = await Category.findById(id);
    if (!existing) return res.status(404).json({ error: "Category not found" });

    const update = {};
    if (name && name.trim()) update.name = name.trim();
    if (parent !== undefined) update.parent = parent || null;
    if (description !== undefined) update.description = description;
    if (condition !== undefined) update.condition = condition;
    if (req.file) update.image = `/uploads/${req.file.filename}`;

    const newName = update.name || existing.name;
    const newParent = "parent" in update ? update.parent : existing.parent;
    const newCondition = update.condition || existing.condition;

    const dup = await Category.findOne({
      _id: { $ne: id },
      name: newName,
      parent: newParent || null,
      condition: newCondition,
    });
    if (dup) return res.status(400).json({ error: "Another category with this name already exists under this condition" });

    const cat = await Category.findByIdAndUpdate(id, update, { new: true }).populate("parent", "name");
    res.status(200).json(cat);
  } catch (error) {
    console.error("updateCategory error:", error.message);
    res.status(500).json({ error: "Failed to update category" });
  }
}

export async function seedDefaultCategories(req, res) {
  try {
    const condition = req.query.condition || 'new';
    const defaults = [
      { name: "Processor", subs: ["Intel", "AMD"] },
      { name: "GPU", subs: ["NVIDIA", "AMD"] },
      { name: "Motherboard", subs: ["Intel", "AMD"] },
      { name: "RAM", subs: ["DDR4", "DDR5"] },
      { name: "Storage", subs: ["SSD", "HDD", "NVMe"] },
      { name: "PSU", subs: ["Modular", "Non-Modular"] },
      { name: "CPU Cooler", subs: ["Air", "Liquid"] },
      { name: "Case", subs: ["Full Tower", "Mid Tower", "Mini"] },
      { name: "Monitor", subs: ["1080p", "1440p", "4K"] },
      { name: "Peripherals", subs: ["Keyboard", "Mouse", "Headset"] },
      { name: "Accessories", subs: ["Cable", "Thermal Paste", "Fan"] },
      { name: "Laptop", subs: ["Gaming", "Ultrabook", "Workstation"] },
    ];
    let count = 0;
    for (const { name, subs } of defaults) {
      let parentCat = await Category.findOne({ name, parent: null, condition });
      if (!parentCat) {
        parentCat = await Category.create({ name, condition });
        count++;
      }
      for (const sub of subs) {
        const exists = await Category.findOne({ name: sub, parent: parentCat._id, condition });
        if (!exists) {
          await Category.create({ name: sub, parent: parentCat._id, condition });
          count++;
        }
      }
    }
    res.status(200).json({ message: `Seeded ${count} ${condition} categories`, total: defaults.reduce((s, d) => s + 1 + d.subs.length, 0) });
  } catch (error) {
    console.error("seedDefaultCategories error:", error.message);
    res.status(500).json({ error: "Failed to seed categories" });
  }
}
