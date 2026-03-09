// @ts-check
const {env} = require('node:process');
const {setTimeout: sleep} = require('node:timers/promises');

const GITHUB_API = 'https://api.github.com';
const UNAUTHENTICATED_DELAY_MS = 800;

function isAuthenticated() {
	return Boolean(env.GITHUB_TOKEN);
}

function getHeaders() {
	/** @type {Record<string, string>} */
	const headers = {Accept: 'application/vnd.github.v3+json', 'User-Agent': 'gt3'};
	if (env.GITHUB_TOKEN) {
		headers.Authorization = `token ${env.GITHUB_TOKEN}`;
	}

	return headers;
}

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function githubGet(url) {
	const response = await fetch(url, {headers: getHeaders()});
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`GitHub API ${response.status} for ${url}: ${body}`);
	}

	return response.json();
}

/**
 * Download raw file content from GitHub (does not count against API rate limit).
 * @param {string} repo
 * @param {string} ref
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function fetchRawContent(repo, ref, filePath) {
	const url = `https://raw.githubusercontent.com/${repo}/${ref}/${filePath}`;
	const response = await fetch(url, {headers: {'User-Agent': 'gt3'}});
	if (!response.ok) {
		throw new Error(`GitHub raw ${response.status} for ${url}`);
	}

	return response.text();
}

/**
 * Use the Git Trees API to list all files in a repo (or subtree) in a single request.
 * Returns only .hbs file paths.
 * @param {string} repo
 * @param {string} ref
 * @param {string} [subpath]
 * @returns {Promise<string[]>}
 */
async function listHbsFilesViaTree(repo, ref, subpath) {
	if (!isAuthenticated()) {
		await sleep(UNAUTHENTICATED_DELAY_MS);
	}

	const url = `${GITHUB_API}/repos/${repo}/git/trees/${ref}?recursive=1`;
	const data = await githubGet(url);

	/** @type {string[]} */
	const results = [];
	const prefix = subpath ? `${subpath}/` : '';

	for (const item of data.tree) {
		if (item.type !== 'blob') {
			continue;
		}

		if (!item.path.endsWith('.hbs')) {
			continue;
		}

		if (subpath && !item.path.startsWith(prefix)) {
			continue;
		}

		results.push(item.path);
	}

	return results;
}

/**
 * Fetch all .hbs files from a GitHub repo (or a subpath within it).
 * Uses the Git Trees API (1 request) to list files, then raw.githubusercontent.com
 * to download content (not rate-limited).
 *
 * @param {object} options
 * @param {string} options.repo - e.g. "TryGhost/Casper"
 * @param {string} options.ref - e.g. "main"
 * @param {string} [options.path] - optional subpath within the repo
 * @param {string[]} [options.files] - optional allowlist of specific filenames
 * @returns {Promise<Array<{path: string, contents: string}>>}
 */
async function fetchHbsFiles({repo, ref, path: subpath, files: allowlist}) {
	const basePath = subpath || '';
	const throttle = !isAuthenticated();

	/** @type {Array<{repoPath: string, outputPath: string}>} */
	let filesToFetch;

	if (allowlist && allowlist.length > 0) {
		filesToFetch = allowlist
			.filter((f) => f.endsWith('.hbs'))
			.map((fileName) => ({
				repoPath: basePath ? `${basePath}/${fileName}` : fileName,
				outputPath: fileName,
			}));
	} else {
		const hbsPaths = await listHbsFilesViaTree(repo, ref, basePath);
		filesToFetch = hbsPaths.map((filePath) => ({
			repoPath: filePath,
			outputPath: basePath ? filePath.slice(basePath.length + 1) : filePath,
		}));
	}

	if (!throttle) {
		return Promise.all(
			filesToFetch.map(async ({repoPath, outputPath}) => {
				const contents = await fetchRawContent(repo, ref, repoPath);
				return {path: outputPath, contents};
			}),
		);
	}

	/** @type {Array<{path: string, contents: string}>} */
	const results = [];
	for (const {repoPath, outputPath} of filesToFetch) {
		const contents = await fetchRawContent(repo, ref, repoPath);
		results.push({path: outputPath, contents});
		await sleep(UNAUTHENTICATED_DELAY_MS);
	}

	return results;
}

module.exports.fetchHbsFiles = fetchHbsFiles;
