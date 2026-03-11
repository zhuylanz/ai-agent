#!/usr/bin/env node
// Pre-publish validation: confirm the dist output is present and coherent.
const fs = require('fs');
const path = require('path');

const required = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/tools/index.js',
  'dist/tools/mcp-client.js',
  'dist/tools/json-schema-to-zod.js',
  'dist/models/model-factory.js',
  'dist/models/embeddings-factory.js',
  'dist/memory/memory-manager.js',
  'dist/types/index.js',
];

let ok = true;
for (const file of required) {
  const full = path.join(__dirname, file);
  if (!fs.existsSync(full)) {
    console.error(`✗ Missing: ${file}`);
    ok = false;
  } else {
    console.log(`✓ ${file}`);
  }
}

if (!ok) {
  console.error('\nValidation failed. Run `npm run build` first.');
  process.exit(1);
}

console.log('\nValidation passed — ready to publish.');
