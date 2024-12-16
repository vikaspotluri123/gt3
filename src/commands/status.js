// @ts-check

/**
 * @typedef {import('../types').ParsedTheme} ParsedTheme
 * @typedef {'all' | 'verbose' | 'json' | 'fail' | 'strict' | 'update'} Flag
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
function statusCommand(options, theme) {
	const {'base-lang': baseLang, all, verbose, json, fail, strict, update} = options;

	if (strict && !fail) {
		console.error('Error: --strict can only be used with --fail');
		return 1;
	}

	if (update && fail) {
		console.error('Error: Cannot use --update and --fail together');
		return 1;
	}

	/** @type {Set<string>} */
	let expectedStrings;

	if (baseLang) {
		if (!Object.hasOwn(theme.locales, baseLang)) {
			console.error(`Error: missing base local ${theme.themePath}/locales/${baseLang}.json`);
			return 1;
		}

		expectedStrings = new Set(Object.keys(theme.locales[baseLang]));
	} else {
		expectedStrings = new Set(theme.visitor.translatedStrings.keys());
	}

	const results = [];
	/** @type {import('./_internal/update-locales.js').JsonChanges} */
	const jsonResults = {};
	let strictFail = false;
	let failed = false;

	for (const [locale, strings] of Object.entries(theme.locales)) {
		if (locale === baseLang) {
			continue;
		}

		const {missing, extra} = analyzeLocale(expectedStrings, Object.keys(strings));

		const score = missing.length + extra.length;

		if (!all && score === 0) {
			continue;
		}

		strictFail ||= extra.length > 0;
		failed ||= missing.length > 0;

		jsonResults[locale] = {missing, extra};
		results.push({locale, score, missing, extra});
	}

	const code = Number(strict ? strictFail || failed : fail ? failed : 0);

	if (update) {
		const {applyChanges} = require('./_internal/update-locales.js');
		if (json) {
			console.log(JSON.stringify(jsonResults, null, 2));
		}

		return applyChanges(jsonResults, theme, json, verbose);
	}

	if (json) {
		console.log(JSON.stringify(jsonResults, null, 2));
		return code;
	}

	results.sort((a, b) => b.score - a.score);

	for (const {locale, missing, extra} of results) {
		const fileName = `${theme.themePath}/locales/${locale}.json`;
		console.log(`${fileName}: +${extra.length}/-${missing.length}`);

		if (!verbose) {
			continue;
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

	return code;
}

module.exports.statusCommand = statusCommand;
