// @ts-check
const fs = require('fs/promises');
const _ = require('lodash');
const path = require('path');
const ASTLinter = require('./ast');

const ignore = [
    'node_modules',
    'bower_components',
    '.DS_Store',
    '.git',
    '.svn',
    'Thumbs.db',
    '.yarn-cache'
];

const linter = new ASTLinter();

/**
 * @param {import('fs').Dirent} dirent
 */
function isIgnoredDirent(dirent) {
    return dirent.isDirectory() || ignore.includes(dirent.name);
}

async function readThemeFiles(themePath) {
    themePath = path.join(themePath, '.');
    const response = [];

    for await (const file of fs.glob(`${themePath}/**`, {withFileTypes: true})) {
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
const readFiles = function readFiles(theme) {
    const themeFilesContent = _.filter(theme.files, function (themeFile) {
        if (themeFile && themeFile.ext) {
            return themeFile.ext.match(/\.hbs|\.css|\.js/ig) || themeFile.file.match(/package.json/i);
        }
    });

    // Setup a partials array
    theme.partials = [];

    // Setup the helper object
    theme.helpers = {};

    // CASE: we need the actual content of all css, hbs files, and package.json for our checks
    return Promise.all(themeFilesContent.map((themeFile) => {
        return fs.readFile(path.join(theme.path, themeFile.file), 'utf8').then(function (content) {
            themeFile.content = content;

            if (!theme.customSettings) {
                theme.customSettings = {};
            }

            const packageJsonMatch = themeFile.file === 'package.json';
            if (packageJsonMatch) {
                try {
                    const packageJson = JSON.parse(themeFile.content);
                    if (packageJson.config && packageJson.config.custom) {
                        theme.customSettings = packageJson.config.custom;
                    }
                } catch (e) {
                    // Ignore error as they will be caught in 010-package-json.js
                }
            }

            const partialMatch = themeFile.file.match(/^partials[/\\]+(.*)\.hbs$/);
            if (partialMatch) {
                theme.partials.push(partialMatch[1]);
            }

            const handlebarsMatch = themeFile.file.match(/\.hbs$/);
            if (handlebarsMatch) {
                themeFile.parsed = ASTLinter.parse(themeFile.content, themeFile.file);
                processHelpers(theme, themeFile);
            }

            delete themeFile.content;
        });
    })).then(() => theme);
};

const processHelpers = function (theme, themeFile) {
    linter.verify({
        parsed: themeFile.parsed,
        visitor: require('./ast/rules/mark-used-helpers.js'),
        source: themeFile.content,
        fileName: themeFile.file
    });
};

/**
 * Works only for posts, pages and custom templates at the moment.
 *
 * @TODO:
 * This fn was added for the custom post template feature https://github.com/TryGhost/Ghost/issues/9060.
 * We've decided to extract custom templates in GScan for now, because the read-theme helper already knows which
 * hbs files are part of a theme.
 *
 * As soon as we have another use case e.g. we would like to allow to parse a custom template header with frontmatter,
 * then we need to know which template is custom, which is not. Also, it could be that
 * this function is outsourced in the future, so it can be used by GScan and Ghost. But for now, we don't pre-optimise.
 */
const extractCustomTemplates = function extractCustomTemplates(allTemplates) {
    var toReturn = [],
        generateName = function generateName(templateName) {
            var name = templateName;

            name = name.replace(/^(post-|page-|custom-)/, '');
            name = name.replace(/-/g, ' ');
            name = name.replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });

            return name.trim();
        },
        generateFor = function (templateName) {
            if (templateName.match(/^page-/)) {
                return ['page'];
            }

            if (templateName.match(/^post-/)) {
                return ['post'];
            }

            return ['page', 'post'];
        },
        generateSlug = function (templateName) {
            if (templateName.match(/^custom-/)) {
                return null;
            }

            return templateName.match(/^(page-|post-)(.*)/)[2];
        };

    _.each(allTemplates, function (templateName) {
        if (templateName.match(/^(post-|page-|custom-)/) && !templateName.match(/\//)) {
            toReturn.push({
                filename: templateName,
                name: generateName(templateName),
                for: generateFor(templateName),
                slug: generateSlug(templateName)
            });
        }
    });

    return toReturn;
};

/**
 * Extracts from all theme files the .hbs files.
 */
const extractTemplates = function extractTemplates(allFiles) {
    return _.reduce(allFiles, function (templates, entry) {
        // CASE: partials are added to `theme.partials`
        if (entry.file.match(/^partials[/\\]+(.*)\.hbs$/)) {
            return templates;
        }

        // CASE: we ignore any hbs files in assets/
        if (entry.file.match(/^assets[/\\]+(.*)\.hbs$/)) {
            return templates;
        }

        var tplMatch = entry.file.match(/(.*)\.hbs$/);
        if (tplMatch) {
            templates.push(tplMatch[1]);
        }
        return templates;
    }, []);
};

/**
 *
 * @param {string} themePath - path to the validated theme
 * @returns {Promise<Theme>}
 */
module.exports = function readTheme(themePath) {
    return readThemeFiles(themePath)
        .then(function (themeFiles) {
            var allTemplates = extractTemplates(themeFiles);

            return readFiles({
                path: themePath,
                files: themeFiles,
                templates: {
                    all: allTemplates,
                    custom: extractCustomTemplates(allTemplates)
                },
                // @TODO: there's no good reason to mix Object and Array formats.
                //        They should be unified and use the one that suits best.
                results: {
                    pass: [],
                    fail: {}
                }
            });
        });
};

/**
 * @typedef {Object} Theme
 * @param {string} path
 * @param {string[]} files
 * @param {Object} templates
 * @param {Object[]} templates.all
 * @param {Object[]} templates.custom
 * @param {string[]} [partials]
 * @param {Object} helpers
 * @param {Object} results
 * @param {Object[]} results.pass
 * @param {Object} results.fail
 * @param {Object=} customSettings
 */