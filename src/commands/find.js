// @ts-check
const fs = require('node:fs/promises');

/**
 * @typedef {import('../types').ParsedTheme} ParsedTheme
 * @typedef {'update' | 'fail' | 'json' | 'verbose' | 'special-characters'} Flag
 * @typedef {never} Parameter
 * @typedef {Record<Flag, boolean> & Record<Parameter, string>} Options
 *
 * @typedef {{
  text: string;
  location: import('../types.js').SourceLocation;
 }} UpdateItem
 * @typedef {Record<string, Array<UpdateItem>>} ChangesPerFile
 */

const LETTER_REGEX = /[\p{L}]/gu;

/**
 * @param {string} text
 */
function isSpecialCharactersOnly(text) {
	return text.match(LETTER_REGEX) === null;
}

/**
 * @param {ParsedTheme['visitor']['textToTranslate']} textToTranslate
 * @param {boolean} includeSpecialCharacters
 */
function prepareTranslationTextForUpdate(textToTranslate, includeSpecialCharacters) {
	/**
	 * @type {ChangesPerFile}
	 */
	const changesPerFile = {};

	for (const [token, sources] of textToTranslate.entries()) {
		if (!includeSpecialCharacters && isSpecialCharactersOnly(token)) {
			continue;
		}

		for (const location of sources) {
			// biome-ignore lint/suspicious/noAssignInExpressions: it's harder to grok with it
			const store = (changesPerFile[location.source] ??= []);
			store.push({text: token, location});
		}
	}

	for (const store of Object.values(changesPerFile)) {
		// Sort by line number decrementing so we don't have to compute offsets as we insert text
		store.sort((a, b) => {
			const lineDifference = b.location.start.line - a.location.start.line;
			if (lineDifference !== 0) {
				return lineDifference;
			}

			return b.location.start.column - a.location.start.column;
		});
	}

	return changesPerFile;
}

/**
 * @param {string} text
 */
function wrapTextInTranslationHelper(text) {
	let quote = '"';
	let normalizedText = text;

	if (text.includes('"')) {
		if (text.includes("'")) {
			normalizedText = text.replaceAll('"', '\\"');
		} else {
			quote = "'";
		}
	}

	return `{{t ${quote}${normalizedText}${quote}}}`;
}

/**
 * @param {ParsedTheme} theme
 * @param {ChangesPerFile} changesPerFile
 * @param {boolean} verbose
 */
async function applyThemeChanges(theme, changesPerFile, verbose) {
	const promises = [];
	for (const file of theme.files) {
		if (!Object.hasOwn(changesPerFile, file.path)) {
			continue;
		}

		const filePath = `${theme.themePath}/${file.path}`;
		const changes = changesPerFile[file.path];
		const lines = file.contents.split('\n');
		const messages = [];

		if (!verbose) {
			messages.push(`Updating ${filePath}`);
		}

		for (const {location, text} of changes) {
			if (location.start.line !== location.end.line) {
				throw new Error('Cannot update multiline strings');
			}

			const lineIndex = location.start.line - 1;
			const updatedText = wrapTextInTranslationHelper(text);

			if (verbose) {
				// Don't include the column number because it won't be correct when there are multiple changes on one line
				messages.push(`${filePath}:${location.start.line} ${text} -> ${updatedText}`);
			}

			const line = lines[lineIndex];
			const prefix = line.slice(0, location.start.column);
			const suffix = line.slice(location.end.column);
			lines[lineIndex] = `${prefix}${updatedText}${suffix}`;
		}

		// Since we make the changes bottom-up, reverse the messages so the user seems them top-down
		messages.reverse();
		for (const message of messages) {
			console.log(message);
		}

		promises.push(fs.writeFile(filePath, lines.join('\n')));
	}

	await Promise.all(promises);
	return 0;
}

/**
 * @param {ParsedTheme} theme
 * @param {boolean} specialCharacters
 * @param {boolean} verbose
 */
async function applyLocaleChanges(theme, specialCharacters, verbose) {
	const missing = [];
	const extra = [];

	for (const token of theme.visitor.textToTranslate.keys()) {
		if (!specialCharacters && isSpecialCharactersOnly(token)) {
			continue;
		}

		missing.push(token);
	}

	/** @type {import('./_internal/update-locales.js').JsonChanges} */
	const changes = {};

	for (const locale of Object.keys(theme.locales)) {
		changes[locale] = {missing, extra};
		console.log(`Updating ${theme.themePath}/locales/${locale}.json`);
	}

	const {applyChanges} = require('./_internal/update-locales.js');
	return applyChanges(changes, theme, false, verbose);
}

/**
 * @param {Options} options
 * @param {ParsedTheme} theme
 */
async function findCommand(options, theme) {
	const {update, fail, json, verbose, 'special-characters': specialCharacters} = options;

	if (update && fail) {
		console.error('Error: Cannot use --update and --fail together');
		process.exit(1);
	}

	if (update) {
		const changes = prepareTranslationTextForUpdate(
			theme.visitor.textToTranslate,
			specialCharacters,
		);

		const results = await Promise.all([
			applyThemeChanges(theme, changes, verbose),
			applyLocaleChanges(theme, specialCharacters, verbose),
		]);

		return results[0] + results[1];
	}

	const {themePath} = theme;
	const {textToTranslate} = theme.visitor;

	if (json) {
		let missingTranslations = Array.from(textToTranslate.keys());
		if (!specialCharacters) {
			missingTranslations = missingTranslations.filter((text) => !isSpecialCharactersOnly(text));
		}

		console.log(JSON.stringify(missingTranslations, null, 2));
	} else {
		for (const [text, sources] of textToTranslate.entries()) {
			if (!specialCharacters && isSpecialCharactersOnly(text)) {
				continue;
			}

			console.log(`"${text}"`);
			if (!verbose) {
				continue;
			}

			for (const {
				source,
				start: {line, column},
			} of sources) {
				console.log(` - ${themePath}/${source}:${line}:${column + 1}`);
			}

			console.log();
		}
	}

	return Number(fail ? textToTranslate.size > 0 : 0);
}

module.exports.findCommand = findCommand;
