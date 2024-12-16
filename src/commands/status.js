// @ts-check
const {exit} = require('node:process');

/**
 * @typedef {import('../types').ParsedTheme} ParsedTheme
 * @typedef {'all' | 'verbose' | 'json' | 'fail' | 'strict'} Flag
 * @typedef {'base-lang'} Parameter
 * @typedef {Record<Flag, boolean> & Record<Parameter, string>} Options
 *
 * @typedef {{
  text: string;
  location: import('../types.js').SourceLocation;
 }} UpdateItem
 * @typedef {Record<string, Array<UpdateItem>>} ChangesPerFile
 */

/**
 * @param {Set<string>} expectedStrings
 * @param {string[]} localeStrings
 */
function analyzeLocale(expectedStrings, localeStrings) {
  const missingStrings = new Set(expectedStrings);
  const extra = [];

  for (const string of localeStrings) {
    const deleted = missingStrings.delete(string);
    if (!deleted) {
      extra.push(string);
    }
  }

  return {
    missing: Array.from(missingStrings),
    extra,
  };
}

/**
 * @param {Options} options
 * @param {ParsedTheme} theme
 */
function statusCommand (options, theme) {
  const {'base-lang': baseLang, all, verbose, json, fail, strict} = options;

  if (strict && !fail) {
    console.error('Error: --strict can only be used with --fail');
    exit(1);
  }

  /** @type {Set<string>} */
  let expectedStrings;

  if (baseLang) {
    if (!Object.hasOwn(theme.locales, baseLang)) {
      console.error(`Error: missing base local ${theme.themePath}/locales/${baseLang}.json`);
      exit(1);
    }

    expectedStrings = new Set(Object.keys(theme.locales[baseLang]));
  } else {
    expectedStrings = new Set(theme.visitor.translatedStrings.keys());
  }

  const results = [];
  const jsonResults = {};

  for (const [locale, strings] of Object.entries(theme.locales)) {
    if (locale === baseLang) {
      continue;
    }

    const {missing, extra} = analyzeLocale(expectedStrings, Object.keys(strings));

    const score = missing.length + extra.length;

    if (!all && score === 0) {
      continue;
    }

    if (json) {
      jsonResults[locale] = {missing, extra};
    } else {
      results.push({locale, score, missing, extra});
    }
  }

  if (json) {
    console.log(JSON.stringify(jsonResults, null, 2));
    return;
  }

  results.sort((a, b) => b.score - a.score);
  let strictFail = false;
  let failed = false;

  for (const {locale, missing, extra} of results) {
    const fileName = `${theme.themePath}/locales/${locale}.json`;
    console.log(`${fileName}: +${extra.length}/-${missing.length}`);
    failed ||= missing.length > 0;
    strictFail ||= extra.length > 0;

    if (!verbose) {
      continue
    }

    for (const [name, result] of Object.entries({extra, missing})) {
      if (result.length === 0) {
        console.log(`  No ${name} strings 🎉`);
      } else {
        const sentenceName = name[0].toUpperCase() + name.slice(1);
        console.log(`  ${sentenceName} strings:`);
        for (const string of result) {
          console.log(`    * ${string}`);
        }
      }
    }

    console.log();
  }

  exit(Number(strict ? strictFail || failed : fail ? failed : 0));
}

module.exports.statusCommand = statusCommand;
