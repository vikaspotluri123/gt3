/**
 * @description confirms if the command can be run based on the theme's translation initialization status
 * @param {import('../../types.js').ParsedTheme} context
 * @param {string} command
 * @returns {boolean} whether the command can be run
 */
module.exports.checkInitialization = (context, command) => {
	const isInitialized = Object.keys(context.locales).length > 0;
	const commandIsInit = command === 'init';
	// Only allow init when not initialized, only allow other commands when initialized
	const stateIsValid = isInitialized !== commandIsInit;

	if (stateIsValid) {
		return true;
	}

	if (isInitialized) {
		console.log('Info: this theme already supports translations. Nothing to do!');
	} else {
		console.error(
			'Error: this theme does not support translations. Run `gt3 --init` to get started!',
		);
	}

	return false;
};
