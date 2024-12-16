// @ts-check
// Pulled from https://github.com/npm/json-parse-even-better-errors/blob/main/lib/index.js
const JSON_FORMAT_REGEX = /^\s*[{[]((?:\r?\n)+)([\s\t]*)/;
const NEWLINE = Symbol.for('NEWLINE');
const INDENTATION = Symbol.for('INDENTATION');

/**
 * @typedef {{
 *   [NEWLINE]: string,
 *   [INDENTATION]: string,
 }} Annotation
 */

/**
 * @template T
 * @param {string} contents
 * @returns {T & Annotation}
 */
function parseJson(contents) {
	const parsedObject = JSON.parse(contents);
	const match = contents.match(JSON_FORMAT_REGEX);
	let newline = '\n';
	let indentation = '\t';
	if (match) {
		newline = match[1] ?? newline;
		indentation = match[2] ?? indentation;
	}

	parsedObject[NEWLINE] = newline;
	parsedObject[INDENTATION] = indentation;

	return parsedObject;
}

/**
 * @template T
 * @param {T} object
 * @returns {asserts object is T & Annotation}
 */
function assertHasAnnotations(object) {
	if (typeof object !== 'object' || object === null) {
		throw new TypeError('Expected object');
	}

	if (!Object.hasOwn(object, NEWLINE)) {
		throw new Error('Missing newline annotation');
	}

	if (!Object.hasOwn(object, INDENTATION)) {
		throw new Error('Missing indentation annotation');
	}
}

/**
 * @param {object} object
 * @returns {string}
 */
function stringifyJson(object) {
	assertHasAnnotations(object);
	const newline = object[NEWLINE];
	const indentation = object[INDENTATION];
	const serialized = JSON.stringify(object, null, indentation);

	return newline === '\n' ? serialized : serialized.replaceAll('\n', newline) + newline;
}

module.exports.NEWLINE = NEWLINE;
module.exports.INDENTATION = INDENTATION;
module.exports.parseJson = parseJson;
module.exports.stringifyJson = stringifyJson;
