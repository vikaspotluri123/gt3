// @ts-check
const fs = require('node:fs/promises');
const path = require('node:path');
const {parseWithoutProcessing} = require('handlebars');
const {getLocales} = require('./util/read-locales.js');

/**
 * @typedef {import('./types.js').ParsedTheme} ParsedTheme
 */

/**
 * @param {import('fs').Dirent} dirent
 */
function isIgnoredDirent(dirent) {
	return dirent.isDirectory();
}

/**
 * @param {string} themePath
 */
async function readGitIgnore(themePath) {
	const gitIgnorePath = path.join(themePath, '.gitignore');
	try {
		const contents = await fs.readFile(gitIgnorePath, 'utf8');
		const {default: createIgnore} = await import('ignore');
		return createIgnore().add(contents);
	} catch {
		return null;
	}
}

/**
 * @param {string} themePath
 * @param {import('ignore').Ignore | null} ignore
 * @returns {Promise<Array<{path: string, contents: string}>>}
 */
async function getHandlebarsFiles(themePath, ignore) {
	const response = [];
	const promises = [];

	for await (const file of fs.glob(`${themePath}/**/*.hbs`, {
		withFileTypes: true,
	})) {
		const fileName = path.relative(themePath, path.join(file.parentPath, file.name));

		// TODO: when passed to `fs.glob#options.exclude`, the file name is passed instead of the dirent.
		// To work around this, we manually run the filter function in the loop
		if (isIgnoredDirent(file) || ignore?.ignores(fileName)) {
			continue;
		}

		promises.push(
			fs.readFile(path.join(themePath, fileName), 'utf8').then((contents) => {
				response.push({
					path: fileName,
					contents,
				});
			}),
		);
	}

	await Promise.all(promises);
	return response;
}

/**
 * @param {string} themePath
 */
function getThemeLocales(themePath) {
	return getLocales(path.join(themePath, 'locales'));
}

/**
 * @param {string} themePath - path to the validated theme
 * @param {typeof import('./ast/visitors/base.js').BaseVisitor} Visitor
 * @returns {Promise<ParsedTheme>}
 */
module.exports = async function readTheme(themePath, Visitor) {
	const resolvedThemePath = path.join(themePath, '.');
	const locales = getThemeLocales(resolvedThemePath);
	const ignore = await readGitIgnore(resolvedThemePath);
	const files = await getHandlebarsFiles(resolvedThemePath, ignore);
	const visitorContext = Visitor.createContext();
	for (const file of files) {
		let ast;

		try {
			ast = parseWithoutProcessing(file.contents, {srcName: file.path});
		} catch (_error) {
			// TODO: handle error
			continue;
		}

		const visitor = new Visitor({source: file.contents, fileName: file.path}, visitorContext);
		visitor.enter(ast);
	}

	return {
		themePath: resolvedThemePath,
		visitor: visitorContext,
		files,
		locales: await locales,
	};
};
