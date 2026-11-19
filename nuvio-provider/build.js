#!/usr/bin/env node
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const provider = process.argv[2] || 'mianime';
const root = __dirname;
const entry = path.join(root, 'src', provider, 'index.js');
const outDir = path.join(root, 'providers');
const outfile = path.join(outDir, `${provider}.js`);

if (!fs.existsSync(entry)) {
  console.error(`No existe el entrypoint: ${entry}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

esbuild.build({
  entryPoints: [entry],
  bundle: true,
  outfile,
  format: 'cjs',
  platform: 'neutral',
  target: 'es2016',
  minify: process.argv.includes('--minify'),
  sourcemap: false,
  banner: { js: `/** ${provider} - Nuvio provider */` },
  logLevel: 'warning'
}).then(() => {
  const kb = (fs.statSync(outfile).size / 1024).toFixed(1);
  console.log(`Built ${outfile} (${kb} KB)`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
