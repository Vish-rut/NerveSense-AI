#!/usr/bin/env node
/**
 * setup-landing.mjs
 * 
 * Copies the AI Tool static site into this project's public/landing/ folder
 * so both sites run together on one dev server (npm run dev → localhost:5173).
 *
 * Run once: node scripts/setup-landing.mjs
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC = resolve(
  "/Users/vishrutshastri/Downloads/ai_tool_tailwind.preview.uideck.com/ai-tool-tailwind.preview.uideck.com"
);
const DEST = resolve(__dirname, "../public/landing");

if (!existsSync(SRC)) {
  console.error(`❌ Source not found: ${SRC}`);
  console.error("Make sure the AI Tool folder is in the expected location.");
  process.exit(1);
}

console.log(`📁 Copying AI Tool site...`);
console.log(`   From: ${SRC}`);
console.log(`   To:   ${DEST}`);

mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });

console.log(`✅ Done! AI Tool site is now in public/landing/`);
console.log(`   Run  npm run dev  and visit http://localhost:5173`);
