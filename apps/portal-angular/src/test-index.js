// Single webpack bundle for every test: Angular, angular-mocks, and every *.spec.js file
// (whose own imports pull in the app source they exercise). See karma.conf.js for why this
// must stay one bundle instead of loading Angular as a separate global script.
import 'angular';
import 'angular-route';
import 'angular-sanitize';
import 'angular-mocks';

// Registers every `angular.module(...)` in the app (as import side effects) exactly once,
// so `angular.mock.module('portalApp.xyz')` in any spec below can find it regardless of
// which spec file runs first — module registration order otherwise wouldn't be guaranteed
// across require.context's discovery order.
import './app/app.module';

const specs = require.context('./app', true, /\.spec\.js$/);
specs.keys().forEach(specs);
