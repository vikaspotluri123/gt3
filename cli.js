#! /usr/bin/env node
// @ts-check
const {argv} = require('node:process');

if (argv.length !== 3) {
  console.error('Usage: node cli.js <path-to-theme>');
  process.exit(1);
}

async function run () {
  const themePath = argv[2];
  const readTheme = require('./src/read-theme.js');
  /* console.dir */(await readTheme(themePath));
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});