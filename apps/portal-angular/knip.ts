import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.js'],
  ignoreDependencies: [
    // Resolved by karma.conf.js via PUPPETEER_CACHE_DIR/os.homedir(), not `require('puppeteer')`
    // -- see AGENTS.md's "Karma needs a Chrome binary" note.
    'puppeteer',
  ],
};

export default config;
