import { readFileSync, readdirSync } from "fs";
import path from "path";
import { deserialize } from "bson";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/count-dump.js <dump-db-folder>");
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".bson"));
let total = 0;

for (const f of files) {
  const buf = readFileSync(path.join(dir, f));
  let off = 0;
  let count = 0;
  while (off < buf.length) {
    const size = buf.readInt32LE(off);
    if (size <= 0 || off + size > buf.length) break;
    deserialize(buf.subarray(off, off + size));
    count++;
    off += size;
  }
  total += count;
  console.log("  " + f.replace(".bson", "").padEnd(20), count);
}

console.log("TOTAL docs in DUMP:", total);
