// @ts-check
const {exit} = require('node:process');
const fs = require('node:fs/promises');

/**
 * @typedef {import('../types').ParsedTheme} ParsedTheme
 * @typedef {'update' | 'fail' | 'json' | 'verbose' | 'special-characters'} Flag
 * @typedef {never} Parameter
 * @typedef {Record<Flag, boolean> & Record<Parameter, string>} Options
 *
 * @typedef {{
  text: string;
  location: import('../types.js').SourceLocation;
 }} UpdateItem
 * @typedef {Record<string, Array<UpdateItem>>} ChangesPerFile
 */

const LETTER_REGEX = /[\p{L}]/gu;

/**
 * @param {string} text
 */
function isSpecialCharactersOnly(text) {
  return text.match(LETTER_REGEX) === null;
}

/**
 * @param {ParsedTheme['visitor']['textToTranslate']} textToTranslate
 * @param {boolean} includeSpecialCharacters
 */
function prepareTranslationTextForUpdate (textToTranslate, includeSpecialCharacters) {
  /**
   * @type {ChangesPerFile}
   */
  const changesPerFile = {};

  for (const [token, sources] of textToTranslate.entries()) {
    if (!includeSpecialCharacters && isSpecialCharactersOnly(token)) {
      continue;
    }

    for (const location of sources) {
      const store = changesPerFile[location.source] ??= [];
      store.push({text: token, location});
    }
  }

  for (const store of Object.values(changesPerFile)) {
    // Sort by line number decrementing so we don't have to compute offsets as we insert text
    store.sort((a, b) => {
      const lineDifference = b.location.start.line - a.location.start.line;
      if (lineDifference !== 0) {
        return lineDifference;
      }

      return b.location.start.column - a.location.start.column;
    });
  }

  return changesPerFile;
}

/**
 * @param {string} text
 */
function wrapTextInTranslationHelper(text) {
  let quote = '"';

  if (text.includes('"')) {
    if (text.includes('\'')) {
      text = text.replaceAll('"', '\\"');
    } else {
      quote = '\'';
    }
  }

  return `{{t ${quote}${text}${quote}}}`;
}

/**
 * @param {ParsedTheme} theme
 * @param {ChangesPerFile} changesPerFile
 * @param {boolean} verbose
 */
async function applyThemeChanges(theme, changesPerFile, verbose) {
  const promises = [];
  for (const file of theme.files) {
    if (!Object.hasOwn(changesPerFile, file.path)) {
      continue;
    }

    const filePath = `${theme.themePath}/${file.path}`;
    const changes = changesPerFile[file.path];
    const lines = file.contents.split('\n');
    const messages = [];

    if (!verbose) {
      messages.push(`Updating ${filePath}`);
    }

    for (const {location, text} of changes) {
      if (location.start.line !== location.end.line) {
        throw new Error('Cannot update multiline strings');
      }

      const lineIndex = location.start.line - 1;
      const updatedText = wrapTextInTranslationHelper(text);

      if (verbose) {
        // Don't include the column number because it won't be correct when there are multiple changes on one line
        messages.push(`${filePath}:${location.start.line} ${text} -> ${updatedText}`);
      }

      const line = lines[lineIndex];
      const prefix = line.slice(0, location.start.column);
      const suffix = line.slice(location.end.column);
      lines[lineIndex] = `${prefix}${updatedText}${suffix}`;
    }

    // Since we make the changes bottom-up, reverse the messages so the user seems them top-down
    messages.reverse();
    for (const message of messages) {
      console.log(message);
    }

    promises.push(
      fs.writeFile(filePath, lines.join('\n'))
    );
  }

  return Promise.all(promises);
}

/**
 * @param {Options} options
 * @param {ParsedTheme} theme
 */
function findCommand(options, theme) {
  const {update, fail, json, verbose, 'special-characters': specialCharacters} = options;

  if (update && fail) {
    console.error('Error: Cannot use --update and --fail together');
    process.exit(1);
  }

  if (update) {
    const changes = prepareTranslationTextForUpdate(theme.visitor.textToTranslate, specialCharacters);
    return applyThemeChanges(theme, changes, verbose);
  }

  const {themePath} = theme;
  const {textToTranslate} = theme.visitor;

  if (json) {
    let missingTranslations = Array.from(textToTranslate.keys());
    if (!specialCharacters) {
      missingTranslations = missingTranslations.filter(text => !isSpecialCharactersOnly(text));
    }

    console.log(JSON.stringify(missingTranslations, null, 2));
  } else {
    for (const [text, sources] of textToTranslate.entries()) {
      if (!specialCharacters && isSpecialCharactersOnly(text)) {
        continue;
      }

      console.log(`"${text}"`);
      if (!verbose) {
        continue;
      }

      for (const {source, start: {line, column}} of sources) {
        console.log(` - ${themePath}/${source}:${line}:${column + 1}`);
      }

      console.log();
    }
  }

  exit(Number(fail ? Boolean(textToTranslate.size) : 0));
}

module.exports.findCommand = findCommand;
