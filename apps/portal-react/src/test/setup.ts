import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var fetchMock: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  globalThis.fetchMock = vi.fn();
  globalThis.fetch = globalThis.fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
