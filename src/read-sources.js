// @ts-check
const fs = require('node:fs/promises');
const path = require('node:path');
const {parseWithoutProcessing} = require('handlebars');
const {TranslatedStringsVisitor} = require('./ast/visitors/translated-strings.js');
const {fetchHbsFiles} = require('./util/github-fetcher.js');
const {getLocales} = require('./util/read-locales.js');

/**
 * @typedef {import('./ast/visitors/translated-strings.js').TranslatedString} TranslatedString
 *
 * @typedef {{
 *   themesRepo: string;
 *   output: string;
 *   themePackages: {path: string; exclude: string[]};
 *   sharedPartials: string;
 *   externalSources: Array<{
 *     name: string;
 *     repo: string;
 *     ref: string;
 *     path?: string;
 *     local?: string | null;
 *     files?: string[];
 *   }>;
 * }} SuperUpdateConfig
 *
 * @typedef {{
 *   translatedStrings: Map<string, TranslatedString>;
 *   keySources: Map<string, Set<string>>;
 *   locales: Record<string, Record<string, string>>;
 *   outputPath: string;
 * }} SourcesResult
 */

/**
 * Glob for .hbs files in a local directory (non-recursive into .gitignored dirs).
 * @param {string} dirPath
 * @returns {Promise<Array<{path: string, contents: string}>>}
 */
async function getLocalHbsFiles(dirPath) {
	const results = [];
	const promises = [];

	for await (const file of fs.glob(`${dirPath}/**/*.hbs`, {withFileTypes: true})) {
		if (file.isDirectory()) {
			continue;
		}

		const filePath = path.join(file.parentPath, file.name);
		const relativePath = path.relative(dirPath, filePath);

		promises.push(
			fs.readFile(filePath, 'utf8').then((contents) => {
				results.push({path: relativePath, contents});
			}),
		);
	}

	await Promise.all(promises);
	return results;
}

/**
 * @param {Array<{path: string, contents: string}>} files
 * @param {string} sourceName
 * @param {ReturnType<typeof TranslatedStringsVisitor.createContext>} visitorContext
 * @param {Map<string, Set<string>>} keySources
 */
function processFiles(files, sourceName, visitorContext, keySources) {
	for (const file of files) {
		const fileLabel = `${sourceName}/${file.path}`;

		const locationCountsBefore = new Map();
		for (const [key, data] of visitorContext.translatedStrings) {
			locationCountsBefore.set(key, data.locations.length);
		}

		let ast;
		try {
			ast = parseWithoutProcessing(file.contents, {srcName: file.path});
		} catch {
			continue;
		}

		const visitor = new TranslatedStringsVisitor(
			{source: file.contents, fileName: file.path},
			visitorContext,
		);
		visitor.enter(ast);

		for (const [key, data] of visitorContext.translatedStrings) {
			const prevCount = locationCountsBefore.get(key) ?? 0;
			if (data.locations.length > prevCount) {
				if (!keySources.has(key)) {
					keySources.set(key, new Set());
				}

				keySources.get(key).add(fileLabel);
			}
		}
	}
}

/**
 * Scan a single local theme directory for .hbs files and process them.
 * @param {string} themePath
 * @param {string} sourceName
 * @param {ReturnType<typeof TranslatedStringsVisitor.createContext>} visitorContext
 * @param {Map<string, Set<string>>} keySources
 */
async function scanLocalTheme(themePath, sourceName, visitorContext, keySources) {
	const exists = await fs.stat(themePath).then(
		(s) => s.isDirectory(),
		() => false,
	);
	if (!exists) {
		console.error(`Warning: skipping ${sourceName} - directory not found: ${themePath}`);
		return;
	}

	const files = await getLocalHbsFiles(themePath);
	processFiles(files, sourceName, visitorContext, keySources);
}

/**
 * List theme package directories in the Themes repo, excluding configured dirs.
 * @param {string} packagesDir
 * @param {string[]} exclude
 * @returns {Promise<Array<{name: string, path: string}>>}
 */
async function listThemePackages(packagesDir, exclude) {
	const entries = await fs.readdir(packagesDir, {withFileTypes: true});
	return entries
		.filter((e) => e.isDirectory() && !exclude.includes(e.name) && !e.name.startsWith('.'))
		.map((e) => ({name: e.name, path: path.join(packagesDir, e.name)}));
}

/**
 * Resolve an external source: use local path if available, otherwise fetch from GitHub.
 * @param {SuperUpdateConfig['externalSources'][number]} source
 * @param {string} baseDir - base directory for resolving relative paths (typically cwd)
 * @returns {Promise<Array<{path: string, contents: string}>>}
 */
async function resolveExternalSource(source, baseDir) {
	if (source.local) {
		const localPath = path.resolve(baseDir, source.local);
		const exists = await fs.stat(localPath).then(
			(s) => s.isDirectory() || s.isFile(),
			() => false,
		);

		if (exists) {
			console.log(`  ${source.name}: reading from local path ${localPath}`);
			return getLocalHbsFiles(localPath);
		}

		console.log(`  ${source.name}: local path not found, falling back to GitHub`);
	}

	console.log(`  ${source.name}: fetching from GitHub ${source.repo}${source.path ? `/${source.path}` : ''}`);
	return fetchHbsFiles({
		repo: source.repo,
		ref: source.ref,
		path: source.path,
		files: source.files,
	});
}

/**
 * Read all sources defined in the config and return merged translation data.
 * @param {SuperUpdateConfig} config
 * @param {string} baseDir - base directory for resolving relative paths (typically cwd)
 * @returns {Promise<SourcesResult>}
 */
async function readSources(config, baseDir) {
	const themesRepoPath = path.resolve(baseDir, config.themesRepo);
	const outputPath = path.resolve(themesRepoPath, config.output);

	const visitorContext = TranslatedStringsVisitor.createContext();
	/** @type {Map<string, Set<string>>} */
	const keySources = new Map();

	// Track keys before each source to compute per-source additions
	const keysBefore = () => new Set(visitorContext.translatedStrings.keys());

	// 1. Scan theme packages from the local Themes repo
	console.log('Scanning theme packages...');
	const packagesDir = path.resolve(themesRepoPath, config.themePackages.path);
	const packages = await listThemePackages(packagesDir, config.themePackages.exclude);

	for (const pkg of packages) {
		const before = keysBefore();
		await scanLocalTheme(pkg.path, pkg.name, visitorContext, keySources);
		const after = new Set(visitorContext.translatedStrings.keys());
		const newKeys = [...after].filter((k) => !before.has(k));
		if (newKeys.length > 0) {
			console.log(`  ${pkg.name}: ${newKeys.length} new key(s)`);
		}
	}

	// 2. Scan shared partials
	console.log('Scanning shared partials...');
	const sharedPartialsPath = path.resolve(themesRepoPath, config.sharedPartials);
	await scanLocalTheme(sharedPartialsPath, '_shared', visitorContext, keySources);

	// 3. Scan external sources (local or GitHub)
	console.log('Scanning external sources...');
	for (const source of config.externalSources) {
		const before = keysBefore();
		const files = await resolveExternalSource(source, baseDir);
		processFiles(files, source.name, visitorContext, keySources);
		const after = new Set(visitorContext.translatedStrings.keys());
		const newKeys = [...after].filter((k) => !before.has(k));
		if (newKeys.length > 0) {
			console.log(`    ${newKeys.length} new key(s)`);
		}
	}

	// 4. Read existing locales from the output directory
	const locales = await getLocales(outputPath);

	return {
		translatedStrings: visitorContext.translatedStrings,
		keySources,
		locales,
		outputPath,
	};
}

module.exports.readSources = readSources;
