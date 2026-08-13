const fs = require('fs');
const os = require('os');
const path = require('path');
const webpackConfig = require('./webpack.config.js')({}, { mode: 'development' });

// puppeteer 25 made executablePath() async, which karma.conf cannot await, so the
// downloaded browser is resolved straight from the puppeteer cache instead.
function resolveChromeBinary() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }

  const cacheDir =
    process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
  const chromeDir = path.join(cacheDir, 'chrome');
  const relativeBinaries = [
    path.join('chrome-linux64', 'chrome'),
    path.join('chrome-linux', 'chrome'),
    path.join(
      'chrome-mac-x64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ),
    path.join(
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing',
    ),
    path.join('chrome-win64', 'chrome.exe'),
  ];

  if (fs.existsSync(chromeDir)) {
    for (const build of fs.readdirSync(chromeDir).sort().reverse()) {
      for (const relative of relativeBinaries) {
        const candidate = path.join(chromeDir, build, relative);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }

  throw new Error(
    'Chrome for Karma was not found. Run `npm install` in apps/portal-angular to download it, ' +
      'or set CHROME_BIN to an existing Chrome/Chromium binary.',
  );
}

process.env.CHROME_BIN = resolveChromeBinary();

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    // Angular, angular-mocks, every app module and every *.spec.js file all go through this
    // one webpack bundle (see src/test-index.js) rather than loading Angular as a separate
    // global <script>. Two separately-bundled copies of the 'angular' package would each
    // carry their own module registry, so app modules registered in one copy would be
    // invisible to angular-mocks' `module()`/`inject()` in the other.
    files: [{ pattern: 'src/test-index.js', watched: false }],
    preprocessors: {
      'src/test-index.js': ['webpack'],
    },
    webpack: {
      mode: 'development',
      module: webpackConfig.module,
      resolve: webpackConfig.resolve,
    },
    webpackMiddleware: {
      stats: 'errors-only',
    },
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-webpack'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      // --no-sandbox is required to run Chrome inside containers and CI images.
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
