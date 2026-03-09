# GT3

> Ghost Theme Translation Toolkit

A toolkit to simplify theme translation.

## Features

GT3 can:

* Detect and wrap untranslated strings in your theme
* Report and update locales with extra/missing translations
* Scan across multiple Ghost repositories (Casper, Source, all theme packages, Ghost core templates) and build a unified set of locale files and a `context.json`

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

### `gt3 super-update`

Scans all Ghost theme sources and updates the shared `theme-translations` locale files and `context.json`. Unlike the other commands, `super-update` does not take a theme path -- it reads from multiple sources defined in a config file.

Options:

  * `--config=<path>`: Path to config file (default: `super-update.config.json` in the gt3 root)
  * `--verbose`: Show detailed per-key changes (which keys are added/removed)
  * `--dry-run`: Show what would change without writing any files

#### Sources scanned

The command collects all `{{t "..."}}` translation strings from:

* **Theme packages** in the local Themes repo (e.g. alto, bulletin, dawn, ...) -- excluding `_shared` and `theme-translations`
* **Shared partials** (`_shared/partials`) in the Themes repo
* **Casper** and **Source** themes (fetched from GitHub if not available locally)
* **Ghost core tpl helpers** (`ghost/core/core/frontend/helpers/tpl/*.hbs`) -- pagination, content-cta, etc.
* **private.hbs** (`ghost/core/core/frontend/apps/private-blogging/lib/views/private.hbs`)

#### Output

All output is written to the configured output directory (default: `Themes/packages/theme-translations/locales/`):

* **`en.json`** (and any other locale files): keys are synced -- missing keys are added with empty values, keys no longer found in any source are removed.
* **`context.json`**: maps each translation key to a description. Existing hand-written descriptions are preserved. New keys get auto-populated with a comma-separated list of source files where they appear (e.g. `"solo/post.hbs, ghost-tpl/pagination.hbs"`).

#### Configuration

The command looks for `super-update.config.json` in the current working directory first, then falls back to the bundled default in the gt3 package. All paths in the config are resolved relative to cwd.

```json
{
  "themesRepo": ".",
  "output": "packages/theme-translations/locales",
  "themePackages": {
    "path": "packages",
    "exclude": ["_shared", "theme-translations"]
  },
  "sharedPartials": "packages/_shared/partials",
  "externalSources": [
    {
      "name": "casper",
      "repo": "TryGhost/Casper",
      "ref": "main",
      "local": null
    },
    {
      "name": "source",
      "repo": "TryGhost/Source",
      "ref": "main",
      "local": null
    },
    {
      "name": "ghost-tpl",
      "repo": "TryGhost/Ghost",
      "ref": "main",
      "path": "ghost/core/core/frontend/helpers/tpl",
      "local": null
    },
    {
      "name": "ghost-private",
      "repo": "TryGhost/Ghost",
      "ref": "main",
      "path": "ghost/core/core/frontend/apps/private-blogging/lib/views",
      "files": ["private.hbs"],
      "local": null
    }
  ]
}
```

* **`themesRepo`**: Path to the local Themes repo, relative to cwd (required -- it contains both sources and the output directory). Use `"."` when running from the Themes repo root.
* **`output`**: Directory within `themesRepo` where locale files are written.
* **`themePackages`**: Which subdirectories of `themesRepo` to scan as individual themes.
* **`sharedPartials`**: Path within `themesRepo` for shared partials.
* **`externalSources`**: Sources that may not be available locally. Each entry has:
  * `name`: Label used in context.json source tracking
  * `repo`: GitHub `owner/repo` for fetching
  * `ref`: Git ref to fetch (e.g. `main`)
  * `path` (optional): Subdirectory within the repo
  * `files` (optional): Allowlist of specific filenames to read
  * `local` (optional): Local filesystem path. If set and the path exists, reads from disk instead of fetching from GitHub.

#### Local development with all repos

If you have the Ghost repo checked out locally, set `local` paths to avoid GitHub API calls:

```json
{
  "name": "casper",
  "repo": "TryGhost/Casper",
  "ref": "main",
  "local": "../Ghost/ghost/core/content/themes/casper"
}
```

#### CI usage

Leave `local` as `null` for external sources. Only the Themes repo needs to be checked out. Set the `GITHUB_TOKEN` environment variable to avoid API rate limits:

```bash
export GITHUB_TOKEN=ghp_...
gt3 super-update
```