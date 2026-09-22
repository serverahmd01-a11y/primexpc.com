// Entry-point shim.
// Some deployment platforms (e.g. Hostinger) auto-detect "index.js" as the
// entry file from package.json's "main" field. The real server lives in
// src/server.js, so this file simply loads it. This makes both "index.js"
// and "src/server.js" valid entry points.
import "./src/server.js";
