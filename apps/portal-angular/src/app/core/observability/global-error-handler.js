/**
 * Decorates $exceptionHandler so every otherwise-uncaught error (template expression
 * errors, promise rejections Angular funnels through here, etc.) is reported, in addition
 * to Angular's own default handling ($delegate, called first, preserves the default
 * console.error logging).
 *
 * Unlike Angular's `ErrorHandler` (constructed before the router is guaranteed ready, so it
 * has to inject `Injector` and resolve `Router` lazily inside `handleError`), it turns out
 * `$exceptionHandler` needs the same lazy-resolution trick for the opposite reason: `$route`
 * depends on `$location`, and `$location`'s provider depends on `$rootScope`, whose provider
 * in turn depends on `$exceptionHandler`. Injecting `$location` directly into this decorator
 * closes that cycle (`$rootScope <- $location <- $exceptionHandler <- $rootScope`) and
 * `angular.bootstrap` throws `$injector:cdep` before anything renders. Injecting `$injector`
 * and calling `.get('$location')` inside `handleError`, after bootstrap has finished
 * constructing everything, avoids the cycle.
 */
export function globalExceptionHandlerDecorator($delegate, $injector, telemetryService) {
  return function handleError(exception, cause) {
    $delegate(exception, cause);

    // Deliberately never forward exception.message to telemetry: it is free text
    // describing whatever failed, and in a patient-data app it can echo user-entered
    // content (e.g. a JSON.parse SyntaxError quoting a fragment of the bad input).
    // exception.name is a small, code-controlled value -- a built-in (TypeError,
    // RangeError, ...) or one of our own classes, never user data -- and is enough to
    // triage by.
    const name = exception instanceof Error ? exception.name : 'UnknownError';

    telemetryService.reportEvent('error', name, {
      route: $injector.get('$location').path(),
      errorCode: 'UNCAUGHT_EXCEPTION',
    });
  };
}

globalExceptionHandlerDecorator.$inject = ['$delegate', '$injector', 'telemetryService'];
