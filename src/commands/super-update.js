// @ts-check
const fs = require('node:fs/promises');
const path = require('node:path');
const {parseJson, stringifyJson, NEWLINE, INDENTATION} = require('../util/inline-json.js');

/**
 * @typedef {'verbose' | 'dry-run'} Flag
 * @typedef {'config'} Parameter
 * @typedef {Record<Flag, boolean> & Record<Parameter, string>} Options
 * @typedef {import('../read-sources.js').SourcesResult} SourcesResult
 */

/**
 * Read context.json from the output directory if it exists.
 * @param {string} outputPath
 * @returns {Promise<Record<string, string> | null>}
 */
async function readContext(outputPath) {
	const contextPath = path.join(outputPath, 'context.json');
	try {
		const contents = await fs.readFile(contextPath, 'utf8');
		return parseJson(contents);
	} catch {
		return null;
	}
}

/**
 * Build a fresh context object, preserving existing hand-written descriptions.
 * @param {Map<string, Set<string>>} keySources
 * @param {Record<string, string> | null} existingContext
 * @returns {Record<string, string>}
 */
function buildContext(keySources, existingContext) {
	/** @type {Record<string, string>} */
	const context = {};

	const sortedKeys = [...keySources.keys()].sort((a, b) => a.localeCompare(b));

	for (const key of sortedKeys) {
		const existing = existingContext?.[key];
		if (existing && existing.length > 0) {
			context[key] = existing;
		} else {
			const sources = keySources.get(key);
			context[key] = sources ? [...sources].sort().join(', ') : '';
		}
	}

	return context;
}

/**
 * @param {Options} options
 * @param {SourcesResult} sources
 */
async function superUpdateCommand(options, sources) {
	const {verbose, 'dry-run': dryRun} = options;
	const {translatedStrings, keySources, locales, outputPath} = sources;

	const expectedKeys = new Set(translatedStrings.keys());

	// --- Analyze locale changes ---
	/** @type {Record<string, {missing: string[], extra: string[]}>} */
	const localeChanges = {};
	let totalMissing = 0;
	let totalExtra = 0;

	for (const [locale, strings] of Object.entries(locales)) {
		const existingKeys = new Set(Object.keys(strings));
		const missing = [...expectedKeys].filter((k) => !existingKeys.has(k));
		const extra = [...existingKeys].filter((k) => !expectedKeys.has(k));

		if (missing.length > 0 || extra.length > 0) {
			localeChanges[locale] = {missing, extra};
			totalMissing += missing.length;
			totalExtra += extra.length;
		}
	}

	// If no locale files exist yet, create en.json
	if (Object.keys(locales).length === 0) {
		const missing = [...expectedKeys];
		localeChanges.en = {missing, extra: []};
		locales.en = {};
		locales.en[NEWLINE] = '\n';
		locales.en[INDENTATION] = '    ';
		totalMissing += missing.length;
	}

	// --- Analyze context changes ---
	const existingContext = await readContext(outputPath);
	const newContext = buildContext(keySources, existingContext);
	const contextAdded = Object.keys(newContext).filter((k) => !existingContext?.[k]);
	const contextRemoved = existingContext
		? Object.keys(existingContext).filter((k) => !(k in newContext) && typeof k === 'string')
		: [];

	// --- Summary ---
	console.log('\n=== Super Update Summary ===');
	console.log(`Total translation keys found: ${expectedKeys.size}`);
	console.log(`Locale files: ${Object.keys(locales).length}`);

	if (totalMissing > 0 || totalExtra > 0) {
		console.log(`\nLocale changes:`);
		for (const [locale, {missing, extra}] of Object.entries(localeChanges)) {
			console.log(`  ${locale}.json: +${missing.length} missing, -${extra.length} extra`);
			if (verbose) {
				for (const key of missing) {
					console.log(`    + "${key}"`);
				}

				for (const key of extra) {
					console.log(`    - "${key}"`);
				}
			}
		}
	} else {
		console.log('\nAll locale files are up to date.');
	}

	if (contextAdded.length > 0 || contextRemoved.length > 0) {
		console.log(`\nContext changes: +${contextAdded.length} added, -${contextRemoved.length} removed`);
		if (verbose) {
			for (const key of contextAdded) {
				console.log(`  + "${key}": "${newContext[key]}"`);
			}

			for (const key of contextRemoved) {
				console.log(`  - "${key}"`);
			}
		}
	} else {
		console.log('\ncontext.json is up to date.');
	}

	if (dryRun) {
		console.log('\n(dry run -- no files written)');
		return 0;
	}

	// --- Write files ---
	await fs.mkdir(outputPath, {recursive: true});
	const writePromises = [];

	for (const [locale, {missing, extra}] of Object.entries(localeChanges)) {
		const store = locales[locale];

		for (const key of missing) {
			store[key] = '';
		}

		for (const key of extra) {
			delete store[key];
		}
	}

	for (const [locale, store] of Object.entries(locales)) {
		const filePath = path.join(outputPath, `${locale}.json`);
		writePromises.push(fs.writeFile(filePath, stringifyJson(store)));
		console.log(`\nWrote ${filePath}`);
	}

	// Write context.json
	const contextWithAnnotations = Object.assign(newContext, {
		[NEWLINE]: '\n',
		[INDENTATION]: '    ',
	});
	const contextPath = path.join(outputPath, 'context.json');
	writePromises.push(fs.writeFile(contextPath, stringifyJson(contextWithAnnotations)));
	console.log(`Wrote ${contextPath}`);

	await Promise.all(writePromises);
	return 0;
}

module.exports.superUpdateCommand = superUpdateCommand;
