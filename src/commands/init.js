/**
 * @typedef {import('../types').ParsedTheme} ParsedTheme
 * @typedef {'no-update'} Flag
 * @typedef {never} Parameter
 * @typedef {Record<Flag, boolean> & Record<Parameter, string>} Options
 */


/**
 * @param {Options} options
 * @param {ParsedTheme} theme
 */
async function initCommand(options, theme) {
  const {'no-update': noUpdate} = options;

  const updateTheme = !noUpdate;
}

module.exports.initCommand = initCommand;