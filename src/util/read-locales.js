// @ts-check
const fs = require('node:fs/promises');
const path = require('node:path');
const {parseJson} = require('./inline-json.js');

/**
 * @param {string} localesPath - absolute path to a locales directory
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
async function getLocales(localesPath) {
	/** @type {Record<string, Record<string, string>>} */
	const locales = {};

	if (
		!(await fs.stat(localesPath).then(
			(stat) => stat.isDirectory(),
			() => false,
		))
	) {
		return locales;
	}

	const promises = [];

	for await (const file of fs.glob(`${localesPath}/*.json`)) {
		const name = path.parse(file).name;
		if (name === 'context') {
			continue;
		}

		promises.push(
			fs.readFile(file, 'utf8').then((contents) => {
				locales[name] = parseJson(contents);
			}),
		);
	}

	await Promise.all(promises);
	return locales;
}

module.exports.getLocales = getLocales;
