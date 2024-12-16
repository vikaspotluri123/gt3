// @ts-check
const fs = require('fs/promises');
const _ = require('lodash');
const path = require('path');
const ASTLinter = require('./ast');

const linter = new ASTLinter();

/**
 * @param {import('fs').Dirent} dirent
 */
function isIgnoredDirent(dirent) {
    return dirent.isDirectory();
}

async function readThemeFiles(themePath) {
    themePath = path.join(themePath, '.');
    const response = [];

    for await (const file of fs.glob(`${themePath}/**/*.hbs`, {withFileTypes: true})) {
        // TODO: when passed to `fs.glob#options.exclude`, the file name is passed instead of the dirent.
        // To work around this, we manually run the filter function in the loop
        if (isIgnoredDirent(file)) {
            continue;
        }

        const fileName = path.relative(themePath, path.join(file.parentPath, file.name));
        const extMatch = fileName.match(/.*?(\.[0-9a-z]+$)/i);

        response.push({
            file: fileName,
            normalizedFile: fileName.replaceAll(/\\/g, ''),
            ext: extMatch !== null ? extMatch[1] : undefined,
            symlink: file.isSymbolicLink(),
        });
    }

    return response;
};

/**
 *
 * @param {Theme} theme
 * @returns {Promise<Theme>}
 */
async function readFiles(theme) {
    // CASE: we need the actual content of all css, hbs files, and package.json for our checks
    return Promise.all(theme.files.map((themeFile) => {
        return fs.readFile(path.join(theme.path, themeFile.file), 'utf8').then(function (content) {
            themeFile.parsed = ASTLinter.parse(content, themeFile.file);
            processHelpers(content, themeFile);
        });
    })).then(() => theme);
};

const processHelpers = function (content, themeFile) {
    linter.verify({
        parsed: themeFile.parsed,
        visitor: require('./ast/rules/mark-used-helpers.js'),
        source: content,
        fileName: themeFile.file
    });
};

/**
 *
 * @param {string} themePath - path to the validated theme
 * @returns {Promise<Theme>}
 */
module.exports = function readTheme(themePath) {
    return readThemeFiles(themePath)
        .then(function (themeFiles) {
            return readFiles({
                path: themePath,
                files: themeFiles,
            });
        });
};

/**
 * @typedef {Object} Theme
 * @param {string} path
 * @param {string[]} files
 */