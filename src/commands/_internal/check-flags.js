// @ts-check
const {exit} = require('node:process');

/**
 * @param {import('minimist').ParsedArgs} args
 * @param {string[]} flags
 * @param {string[]} parameters
 */
function checkFlags(args, flags, parameters) {
	let errored = false;

	for (const [key, value] of Object.entries(args)) {
		if (key === '_' || key === '--') {
			continue;
		}

		if (!(flags.includes(key) || parameters.includes(key))) {
			console.error(`Error: unknown argument: ${key}`);
			errored = true;
			continue;
		}

		if (flags.includes(key) && typeof value !== 'boolean') {
			console.error(`Error: expected ${key} to be a boolean flag`);
			errored = true;
			continue;
		}

		if (parameters.includes(key) && typeof value !== 'string') {
			console.error(`Error: expected ${key} to have a value`);
			errored = true;
		}
	}

	if (errored) {
		exit(1);
	}
}

module.exports.checkFlags = checkFlags;
