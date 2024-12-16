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
  const {multiVisitor} = require('./src/ast/visitors/many.js');
  const visitors = [
      require('./src/ast/visitors/translated-strings.js').TranslatedStringsVisitor,
      require('./src/ast/visitors/text-extractor.js'),
  ];

  const Visitor = multiVisitor(visitors);
  const context = await readTheme(themePath, Visitor);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});