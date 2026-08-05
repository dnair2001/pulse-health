const fs = require('fs');
const os = require('os');
const path = require('path');

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
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: path.join(__dirname, './coverage/portal-angular'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
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
