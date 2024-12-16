// @ts-check
const fs = require('node:fs/promises');
const {stringifyJson} = require('../../util/inline-json.js');

/**
 * @typedef {import('../../types').ParsedTheme} ParsedTheme
 * @typedef {Record<string, {missing: string[]; extra: string[]}>} JsonChanges
 */

/**
 * @param {JsonChanges} changes
 * @param {ParsedTheme} theme
 * @param {boolean} print
 * @param {boolean} verbose
 */
async function applyChanges(changes, theme, print, verbose) {
	const promises = [];
	const printVerbose = verbose && !print;

	for (const [locale, {missing, extra}] of Object.entries(changes)) {
		const filePath = `${theme.themePath}/locales/${locale}.json`;
		const store = theme.locales[locale];

		if (!print) {
			console.log(`Updating ${filePath}`);
		}

		for (const string of missing) {
			store[string] = '';

			if (printVerbose) {
				console.log(`  - Add "${string}"`);
			}
		}

		for (const string of extra) {
			delete store[string];

			if (printVerbose) {
				console.log(`  - Remove "${string}"`);
			}
		}

		promises.push(fs.writeFile(filePath, stringifyJson(store)));
		if (printVerbose) {
			console.log('');
		}
	}

	await Promise.all(promises);
	return 0;
}

module.exports.applyChanges = applyChanges;
