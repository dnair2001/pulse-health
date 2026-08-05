import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.ts'],
  ignoreDependencies: [
    // Read from angular.json's schematicCollections, not imported by any TS file.
    '@angular-eslint/schematics',
    // Loaded implicitly by @angular-eslint/eslint-plugin-template's parser config in
    // .eslintrc.json (a string extends, not an import), so knip can't see the reference.
    '@angular-eslint/template-parser',
    // Resolved by karma.conf.js via PUPPETEER_CACHE_DIR/os.homedir(), not `require('puppeteer')`
    // -- see AGENTS.md's "Karma needs a Chrome binary" note.
    'puppeteer',
  ],
};

export default config;
