// @ts-check
const {exit} = require('node:process');

/**
 * @typedef {import('../types').ParsedTheme} ParsedTheme
 * @typedef {'update' | 'fail' | 'json' | 'verbose'} Flag
 * @typedef {never} Parameter
 * @typedef {Record<Flag, boolean> & Record<Parameter, string>} Options
 */

/**
 * @param {Options} options
 * @param {ParsedTheme} theme
 */
function findCommand (options, theme) {
  const {update, fail, json, verbose} = options;

  if (update && fail) {
    console.error('Error: Cannot use --update and --fail together');
    process.exit(1);
  }

  if (update) {
    throw new Error('Not implemented');
  }

  const {themePath} = theme;
  const {textToTranslate} = theme.visitor;

  if (json) {
    const missingTranslations = Array.from(textToTranslate.keys());
    console.log(JSON.stringify(missingTranslations, null, 2));
  } else {
    for (const [token, sources] of textToTranslate.entries()) {
      console.log(`"${token}"`);
      if (!verbose) {
        continue;
      }

      for (const {source, start: {line, column}} of sources) {
        console.log(` - ${themePath}/${source}:${line}:${column + 1}`);
      }

      console.log();
    }
  }

  exit(Number(fail ? Boolean(textToTranslate.size) : 0));
}

module.exports.findCommand = findCommand;
