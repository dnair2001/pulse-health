const KNOWN_CODES = [
  'VALIDATION_ERROR',
  'SLOT_IN_PAST',
  'SLOT_ALREADY_BOOKED',
  'APPOINTMENT_NOT_CANCELLABLE',
  'APPOINTMENT_NOT_RESCHEDULABLE',
  'NOT_FOUND',
];

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const REQUEST_ID_HEADER = 'X-Request-Id';

function isEnvelope(body) {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const error = body.error;
  return typeof error === 'object' && error !== null && 'code' in error;
}

function toApiError(response) {
  // $http reports both an unreachable server and a client-aborted request as status -1;
  // Angular's HttpClient used 0 for the same case, so 0 is normalised in here too.
  if (response.status === -1 || response.status === 0) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the Pulse Health API. Check that it is running on port 8000.',
      field: null,
      status: 0,
    };
  }

  if (isEnvelope(response.data)) {
    const { code, message, field } = response.data.error;
    return {
      code: KNOWN_CODES.includes(code) ? code : 'UNKNOWN',
      message: message || FALLBACK_MESSAGE,
      field: field ?? null,
      status: response.status,
    };
  }

  return { code: 'UNKNOWN', message: FALLBACK_MESSAGE, field: null, status: response.status };
}

/**
 * Stamps every outbound request with a fresh `X-Request-Id` and converts every HTTP
 * failure into the ApiError shape the UI renders. A fresh id per request (not one shared
 * for the app's lifetime) is what lets a single browser action be correlated to a single
 * server log line; a caller-supplied id (if a request already carries one) is respected
 * rather than overwritten, mirroring the API's own "use it if present" behaviour.
 */
export function apiErrorInterceptor($q, telemetryService, $location) {
  return {
    request(config) {
      config.headers = config.headers || {};
      if (!config.headers[REQUEST_ID_HEADER]) {
        config.headers[REQUEST_ID_HEADER] = crypto.randomUUID();
      }
      return config;
    },

    responseError(response) {
      const apiError = toApiError(response);
      // 0 (unreachable) and 5xx are server/network-side failures worth alerting on; an
      // UNKNOWN code means we couldn't even parse the error envelope, which is itself a
      // signal something's off. Everything else (4xx with a recognised code) is expected
      // user-facing validation, hence 'warn'.
      const level =
        apiError.status === 0 || apiError.status >= 500 || apiError.code === 'UNKNOWN'
          ? 'error'
          : 'warn';
      const requestId = response.config?.headers?.[REQUEST_ID_HEADER];

      telemetryService.reportEvent(level, apiError.message, {
        route: $location.path(),
        requestId,
        errorCode: apiError.code,
      });

      return $q.reject(apiError);
    },
  };
}

apiErrorInterceptor.$inject = ['$q', 'telemetryService', '$location'];
