import { cpSync, existsSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "..", "web-storefront", "dist");
const dest = path.join(__dirname, "..", "dist");

if (!existsSync(src)) {
  console.error("Frontend dist not found at:", src);
  console.error("Run the frontend build first: npm run build:web");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("Copied frontend dist ->", dest);
