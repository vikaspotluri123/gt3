#! /usr/bin/env node
// @ts-check
const {argv, exit} = require('node:process');

require('./src/commands/_internal/version-check.js');
require('./src/commands/_internal/suppress-warnings.js');

/**
 * @typedef {import('./src/types.js').ParsedTheme} ParsedTheme
 * @typedef {{
  flags?: string[],
  parameters?: string[],
  run: (args: { [key: string]: string | boolean}, theme: ParsedTheme) => void | Promise<void>
 }} CommandDefinition
 */


const help = `
GT3 - The Ghost Theme Translation Toolkit

Commands:

  help : Print his help message

  find <path-to-theme> : Finds untranslated strings
    --special-characters: Consider strings of only special characters as untranslated
    --update: Automatically wrap untranslated strings. This will modify your theme files, so be careful!
    --fail: Exit with a non-zero exit code if any untranslated strings are found. Cannot be used with --update
    --json: Output the results in JSON format
    --verbose: Include file name and line number in the output

  status <path-to-theme> : Reports the translation status of each locale. Empty translations are ignored.
    --all: Report fully translated locales, not just those with untranslated strings
    --base-locale=<locale>: Use this locale as the fully translated reference instead of reading the theme
`.trimStart();

function deferredCommand(importPath, exportName) {
  return (args, theme) => import(importPath).then(m => m[exportName](args, theme));
}

/**
 * @satisfies {Record<string, CommandDefinition>}
 */
const commands = {
  help: {
    run: () => console.log(help),
  },
  find: {
    /** @type {import('./src/commands/find.js').Flag[]} */
    flags: ['update', 'fail', 'json', 'verbose', 'special-characters'],
    run: deferredCommand('./src/commands/find.js', 'findCommand'),
  },
  status: {
    flags: ['all'],
    parameters: ['base-lang'],
    run() {
      throw new Error('not implemented');
    },
  },
};

if (argv.length < 4) {
  console.log(help);

  if (argv.length === 3 && argv[2] !== 'help') {
    console.error('Error: Missing theme path');
  }

  exit(1);
}


function parseCommand() {
  const commandName = argv[2];
  const themePath = argv[3];

  if (commandName === 'help') {
    commands.help.run();
    exit(0);
  }

  /** @type {CommandDefinition} */
  const command = commands[argv[2]];
  if (!command) {
    console.error(`Unknown command: ${argv[2]}`);
    console.error(help);
    exit(1);
  }

  const minimist = require('minimist');
  const args = minimist(argv.slice(3));
  const flags = command.flags ?? [];
  const parameters = command.parameters ?? [];

  require('./src/commands/_internal/check-flags.js').checkFlags(args, flags, parameters);

  return {
    args,
    themePath,
    command: command.run,
  };
}

async function run () {
  const {themePath, args, command} = parseCommand();
  const readTheme = require('./src/read-theme.js');
  const {multiVisitor} = require('./src/ast/visitors/many.js');
  const visitors = [
      require('./src/ast/visitors/translated-strings.js').TranslatedStringsVisitor,
      require('./src/ast/visitors/text-extractor.js'),
  ];

  const Visitor = multiVisitor(visitors);
  const context = await readTheme(themePath, Visitor);

  command(args, context);
}

run().catch(error => {
  console.error(error);
  exit(1);
});