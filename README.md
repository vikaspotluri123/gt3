# GT3

> Ghost Theme Translation Toolkit

A toolkit to simplify theme translation.

## Features

GT3 Can:

* Detect and wrap untranslated strings in your theme
* Report and update locales with extra/missing translations

## Getting Started

GT3 is a command-line tool that you can install with npm:

```bash
npm install gt3
# Get help
npm exec gt3
```

## Commands

### `gt3 find <path-to-theme>`

Finds untranslated strings in your theme.

Options:

  * `--special-characters`: Consider strings of only special characters as untranslated
  * `--update`: Automatically wrap untranslated strings and add them to locales. This will modify your theme files, so be careful!
  * `--fail`: Exit with a non-zero exit code if any untranslated strings are found. Cannot be used with --update
  * `--json`: Output the results in JSON format
  * `--verbose`: Include file name and line number in the output

### `gt3 status <path-to-theme>`

Reports the translation status of each locale. Empty translations are ignored.

Options:

  * `--all`: Report fully translated locales, not just those with untranslated strings
  * `--update`: Automatically sync missing/extra strings in the locales
  * `--base-locale=<locale>:` Use `<locale>` as the fully translated reference instead of reading the theme
  * `--fail`: Exit with a non-zero exit code if any locales are missing strings
  * `--strict`: When used with --fail, also fail if any locales have extra strings
  * `--json`: Output the results in JSON format
  * `--verbose`: List the missing/extra strings for each locale

### `gt3 ci <path-to-theme>`

Runs "find" and "status" in `--fail` mode.

Options:

 * All options supported by "find" and "status" are supported, though `--update` is ignored