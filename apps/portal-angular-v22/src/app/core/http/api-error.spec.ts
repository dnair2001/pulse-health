import { HttpErrorResponse } from '@angular/common/http';

import { toApiError } from './api-error';

// The mappings a request actually exercises (envelope, unreachable API, non-envelope body) are
// covered end to end through the interceptor in provider-directory.service.spec.ts. These two
// cover the branches a request cannot reach from there.
describe('toApiError', () => {
  it('reports an unrecognised error code as UNKNOWN but keeps the API message', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 409,
        error: { error: { code: 'SOMETHING_NEW', message: 'That is not allowed yet.' } },
      }),
    );

    expect(error).toEqual({
      code: 'UNKNOWN',
      message: 'That is not allowed yet.',
      field: null,
      status: 409,
    });
  });

  it('does not leak an internal exception message for a failure that never reached the API', () => {
    const error = toApiError(new TypeError('crypto.randomUUID is not a function'));

    expect(error).toEqual({
      code: 'UNKNOWN',
      message: 'Something went wrong. Please try again.',
      field: null,
      status: 0,
    });
  });
});
