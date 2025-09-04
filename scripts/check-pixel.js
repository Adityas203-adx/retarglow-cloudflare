#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'client', 'pixel.min.js');
if (!fs.existsSync(file)) {
  console.error('Missing client/pixel.min.js. Run npm run build to generate it.');
  process.exit(1);
}
