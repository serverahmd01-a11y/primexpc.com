import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { ENV } from "../config/env.js";

const products = [
  {
    name: "MSI RTX 3070 VENTUS 3X OC 8GB",
    description:
      "OG Seal Intact, never opened. Box not available. Max temp 70°C (runs ice cool). All ports working (HDMI + 3x DisplayPort). Clean card, plug & play ready. 8GB GDDR6, Ray Tracing + DLSS. Beast for AAA games & streaming. 15 days testing warranty. Location: Delhi. Shipping all over India.",
    price: 22000,
    stock: 1,
    category: "GPU",
    subCategory: "NVIDIA",
    condition: "refurbished",
    gstRate: 18,
    images: [],
  },
  {
    name: "Gigabyte RX 6700XT 12GB Gaming OC",
    description:
      "OG Seal Intact. Max temp 73°C, all ports working. Clean card, plug & play ready. 5 days testing warranty. Location: Ahmedabad. Shipping all over India.",
    price: 22000,
    stock: 1,
    category: "GPU",
    subCategory: "AMD",
    condition: "refurbished",
    gstRate: 18,
    images: [],
  },
  {
    name: "Galax RTX 3070 8GB 1-Click OC",
    description:
      "OG Seal Intact. Max temp 72°C, all ports working. Clean card, plug & play ready. 5 days testing warranty. Location: Ahmedabad. Shipping all over India.",
    price: 21000,
    stock: 1,
    category: "GPU",
    subCategory: "NVIDIA",
    condition: "refurbished",
    gstRate: 18,
    images: [],
  },
  {
    name: "PowerColor RX 6700XT 12GB Red Devil",
    description:
      "OG Seal Intact. Max temp 73°C, all ports working. Clean card, plug & play ready. 5 days testing warranty. Location: Ahmedabad. Shipping all over India.",
    price: 22000,
    stock: 1,
    category: "GPU",
    subCategory: "AMD",
    condition: "refurbished",
    gstRate: 18,
    images: [],
  },
  {
    name: "Sapphire RX 580 8GB Nitro Plus",
    description:
      "OG Seal Intact. Max temp 72°C, all ports working. Clean card, plug & play ready. 5 days testing warranty. Location: Ahmedabad. Shipping all over India.",
    price: 7500,
    stock: 1,
    category: "GPU",
    subCategory: "AMD",
    condition: "refurbished",
    gstRate: 18,
    images: [],
  },
  {
    name: "Sapphire RX 6700XT 12GB Nitro Plus",
    description:
      "Mint / Like New condition. Box available, all accessories included. Max temp 72°C, all ports working. Clean card, plug & play ready. 15 days testing warranty. Location: Delhi. Shipping all over India.",
    price: 21000,
    stock: 1,
    category: "GPU",
    subCategory: "AMD",
    condition: "refurbished",
    gstRate: 18,
    images: [],
  },
  {
    name: "MSI RTX 4060 Ti 8GB Gaming X",
    description: "Brand new MSI RTX 4060 Ti. 8GB GDDR6X, DLSS 3, Ray Tracing. Ideal for 1440p gaming.",
    price: 28500,
    salePrice: 25999,
    stock: 2,
    category: "GPU",
    subCategory: "NVIDIA",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "ASUS RTX 4080 16GB TUF Gaming",
    description: "Brand new ASUS TUF RTX 4080. 16GB GDDR6X, DLSS 3, excellent cooling. Flagship 4K card.",
    price: 95000,
    salePrice: 89999,
    stock: 1,
    category: "GPU",
    subCategory: "NVIDIA",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "AMD Ryzen 7 7800X3D",
    description: "Brand new AMD Ryzen 7 7800X3D. 8 cores, 16 threads, 3D V-Cache. Best gaming CPU.",
    price: 32000,
    stock: 3,
    category: "Processor",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Intel Core i5-14600K",
    description: "Brand new Intel i5-14600K. 14 cores (6P+8E), 20 threads. Great for gaming & productivity.",
    price: 22000,
    salePrice: 19999,
    stock: 5,
    category: "Processor",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Corsair Vengeance 32GB DDR5 6000MHz",
    description: "Brand new Corsair Vengeance DDR5. 32GB (2x16GB) kit, 6000MHz, CL36. RGB lighting.",
    price: 8500,
    stock: 10,
    category: "RAM",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "G.Skill Trident Z5 64GB DDR5 6400MHz",
    description: "Brand new G.Skill Trident Z5 RGB. 64GB (2x32GB) kit, 6400MHz, CL32. Premium memory.",
    price: 18500,
    salePrice: 16999,
    stock: 3,
    category: "RAM",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Samsung 990 Pro 2TB NVMe SSD",
    description: "Brand new Samsung 990 Pro. 2TB, PCIe 4.0, read 7450MB/s, write 6900MB/s.",
    price: 14500,
    stock: 4,
    category: "Storage",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "WD Black SN850X 1TB NVMe SSD",
    description: "Brand new WD Black SN850X. 1TB, PCIe 4.0, read 7300MB/s. Gaming optimized.",
    price: 8500,
    salePrice: 7499,
    stock: 6,
    category: "Storage",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "ASUS ROG STRIX B650E-F GAMING WIFI",
    description: "Brand new ASUS ROG STRIX B650E-F. AM5, DDR5, PCIe 5.0, WiFi 6E. Premium ATX board.",
    price: 22500,
    stock: 2,
    category: "Motherboard",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "MSI MAG Z790 TOMAHAWK WIFI",
    description: "Brand new MSI Z790 Tomahawk. LGA1700, DDR5, PCIe 5.0, WiFi 6E. Great mid-range board.",
    price: 19500,
    salePrice: 17999,
    stock: 3,
    category: "Motherboard",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Samsung 27 Odyssey G7 4K 144Hz",
    description: "Brand new Samsung Odyssey G7. 27-inch, 4K UHD, 144Hz, 1ms, HDR600. Curved VA panel.",
    price: 38000,
    stock: 2,
    category: "Monitor",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "LG 27GP850-B 27 QHD 165Hz",
    description: "Brand new LG Ultragear. 27-inch, QHD 2560x1440, 165Hz, 1ms, Nano IPS. Colors are insane.",
    price: 24999,
    salePrice: 21999,
    stock: 4,
    category: "Monitor",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Corsair RM850x 850W 80+ Gold",
    description: "Brand new Corsair RM850x. Fully modular, 80+ Gold, 135mm fan. Quiet & reliable PSU.",
    price: 9500,
    stock: 5,
    category: "PSU",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "NZXT H5 Flow RGB Mid-Tower",
    description: "Brand new NZXT H5 Flow RGB. Mid-tower, tempered glass, dual RGB fans, excellent airflow.",
    price: 7500,
    salePrice: 6499,
    stock: 5,
    category: "Case",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Lian Li O11 Dynamic EVO",
    description: "Brand new Lian Li O11 Dynamic EVO. Dual chamber, ATX, tempered glass. Showpiece case.",
    price: 12500,
    stock: 2,
    category: "Case",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Razer BlackWidow V4 Pro",
    description: "Brand new Razer BlackWidow V4 Pro. Full-size mechanical, Green switches, RGB, wrist rest.",
    price: 14000,
    salePrice: 11999,
    stock: 4,
    category: "Peripherals",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Logitech G Pro X Superlight 2",
    description: "Brand new Logitech G Pro X Superlight 2. Wireless, 60g, HERO 2 sensor, 95hr battery.",
    price: 10500,
    stock: 6,
    category: "Peripherals",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "SteelSeries Arctis Nova Pro Wireless",
    description: "Brand new Steelseries Arctis Nova Pro. Wireless, ANC, swappable battery, Hi-Res audio.",
    price: 22000,
    salePrice: 18999,
    stock: 3,
    category: "Accessories",
    condition: "new",
    gstRate: 18,
    images: [],
  },
  {
    name: "Noctua NH-D15 Chromax Black",
    description: "Brand new Noctua NH-D15. Dual tower CPU cooler, 140mm fans, excellent cooling performance.",
    price: 8500,
    stock: 4,
    category: "CPU Cooler",
    condition: "new",
    gstRate: 18,
    images: [],
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(ENV.DB_URL);
    console.log("✅ Connected to MongoDB\n");

    // Clear everything
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log("🗑️  Cleared existing categories & products\n");

    // Seed GPU (parent) for both conditions
    const gpuCatNew = await Category.create({ name: "GPU", parent: null, description: "Graphics Cards", condition: "new" });
    const gpuCatRefurb = await Category.create({ name: "GPU", parent: null, description: "Graphics Cards", condition: "refurbished" });
    const processorCat = await Category.create({ name: "Processor", parent: null, description: "CPUs", condition: "new" });
    const ramCat = await Category.create({ name: "RAM", parent: null, description: "Memory", condition: "new" });
    const storageCat = await Category.create({ name: "Storage", parent: null, description: "SSDs & HDDs", condition: "new" });
    const motherboardCat = await Category.create({ name: "Motherboard", parent: null, description: "Motherboards", condition: "new" });
    const monitorCat = await Category.create({ name: "Monitor", parent: null, description: "Monitors", condition: "new" });
    const psuCat = await Category.create({ name: "PSU", parent: null, description: "Power Supplies", condition: "new" });
    const caseCat = await Category.create({ name: "Case", parent: null, description: "PC Cases", condition: "new" });
    const peripheralsCat = await Category.create({ name: "Peripherals", parent: null, description: "Keyboards & Mice", condition: "new" });
    const accessoriesCat = await Category.create({ name: "Accessories", parent: null, description: "Headsets & More", condition: "new" });
    const coolerCat = await Category.create({ name: "CPU Cooler", parent: null, description: "Air & Liquid Coolers", condition: "new" });
    // Seed subcategories under GPU (new)
    const amdNew = await Category.create({ name: "AMD", parent: gpuCatNew._id, description: "AMD Radeon Graphics Cards", condition: "new" });
    const nvidiaNew = await Category.create({ name: "NVIDIA", parent: gpuCatNew._id, description: "NVIDIA GeForce Graphics Cards", condition: "new" });
    // Seed subcategories under GPU (refurbished)
    const amdRefurb = await Category.create({ name: "AMD", parent: gpuCatRefurb._id, description: "AMD Radeon Graphics Cards", condition: "refurbished" });
    const nvidiaRefurb = await Category.create({ name: "NVIDIA", parent: gpuCatRefurb._id, description: "NVIDIA GeForce Graphics Cards", condition: "refurbished" });

    console.log("✅ 13 Categories:");
    console.log(`   📁 GPU (parent)`);
    console.log(`      ├── 📁 AMD`);
    console.log(`      └── 📁 NVIDIA`);
    console.log(`   📁 Processor`);
    console.log(`   📁 RAM`);
    console.log(`   📁 Storage`);
    console.log(`   📁 Motherboard`);
    console.log(`   📁 Monitor`);
    console.log(`   📁 PSU`);
    console.log(`   📁 Case`);
    console.log(`   📁 Peripherals`);
    console.log(`   📁 Accessories`);
    console.log(`   📁 CPU Cooler`);

    // Seed products
    await Product.insertMany(products);
    console.log(`\n✅ ${products.length} Products:\n`);

    const amdCount = products.filter((p) => p.subCategory === "AMD").length;
    const nvidiaCount = products.filter((p) => p.subCategory === "NVIDIA").length;

    products.forEach((p) =>
      console.log(`   ${p.subCategory === "AMD" ? "🔴" : "🟢"} ${p.name} — ₹${p.price.toLocaleString("en-IN")}`)
    );

    console.log(`\n📊 Total: ${products.length} | AMD: ${amdCount} | NVIDIA: ${nvidiaCount}`);
    console.log(`💰 Total Value: ₹${products.reduce((sum, p) => sum + p.price, 0).toLocaleString("en-IN")}`);

    await mongoose.connection.close();
    console.log("\n✅ Done — connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seedDatabase();
