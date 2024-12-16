// @ts-check
const fs = require('fs/promises');
const path = require('path');
const {parseWithoutProcessing} = require('handlebars');

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
 * @param {string} themePath
 */
async function getLocales(themePath) {
    const localesPath = path.join(themePath, 'locales');
    /** @type {Record<string, Record<string, string>>} */
    const locales = {};

    if (!await fs.stat(localesPath).then(stat => stat.isDirectory(), () => false)) {
        return locales;
    }

    const promises = [];

    for await (const file of fs.glob(`${localesPath}/*.json`)) {
        const locale = path.parse(file).name;
        promises.push(
            fs.readFile(file, 'utf8').then(contents => {
                locales[locale] = JSON.parse(contents);
            }),
        );
    }

    await Promise.all(promises);
    return locales;
}

/**
 * @param {string} themePath - path to the validated theme
 * @param {typeof import('./ast/visitors/base.js').BaseVisitor} Visitor
 */
module.exports = async function readTheme(themePath, Visitor) {
    const locales = getLocales(themePath)
    const files = await getHandlebarsFiles(themePath);
    const visitorContext = Visitor.createContext();
    for (const file of files) {
        let ast;

        try {
            ast = parseWithoutProcessing(file.contents, {srcName: file.path});
        } catch (error) {
            // TODO: handle error
            continue;
        }

        const visitor = new Visitor({source: file.contents, fileName: file.path}, visitorContext);
        visitor.enter(ast);
    }

    return {
        visitor: visitorContext,
        files,
        locales: await locales,
    };
};