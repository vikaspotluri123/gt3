// @ts-check
const fs = require('fs/promises');
const path = require('path');
const ASTLinter = require('./ast');

const linter = new ASTLinter();

/**
 * @param {import('fs').Dirent} dirent
 */
function isIgnoredDirent(dirent) {
    return dirent.isDirectory();
}

/**
 * @param {string} themePath
 * @returns {Promise<Array<{path: string, contents: string}>>}
 */
async function getHandlebarsFiles(themePath) {
    themePath = path.join(themePath, '.');
    const response = [];
    const promises = [];

    for await (const file of fs.glob(`${themePath}/**/*.hbs`, {withFileTypes: true})) {
        // TODO: when passed to `fs.glob#options.exclude`, the file name is passed instead of the dirent.
        // To work around this, we manually run the filter function in the loop
        if (isIgnoredDirent(file)) {
            continue;
        }

        const fileName = path.relative(themePath, path.join(file.parentPath, file.name));

        promises.push(fs.readFile(path.join(themePath, fileName), 'utf8').then(contents => {
            response.push({
                path: fileName,
                contents,
            });
        }));
    }

    await Promise.all(promises);
    return response;
}

/**
 *
 * @param {string} themePath - path to the validated theme
 */
module.exports = async function readTheme(themePath) {
    const files = await getHandlebarsFiles(themePath);
    for (const file of files) {
        const parsed = ASTLinter.parse(file.contents, file.path);
        linter.verify({
            parsed,
            visitor: require('./ast/rules/mark-used-helpers.js'),
            source: file.contents,
            fileName: file.path
        });
    }
};