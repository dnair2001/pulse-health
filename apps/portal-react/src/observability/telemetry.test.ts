import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkApiHealth, reportEvent } from './telemetry';

describe('reportEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a structured entry to the console at the matching level', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    globalThis.fetchMock.mockResolvedValue({ ok: true } as Response);

    reportEvent('info', 'backend reachable', { route: '/appointments' });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toMatchObject({
      level: 'info',
      message: 'backend reachable',
      route: '/appointments',
    });
    expect(typeof (infoSpy.mock.calls[0][0] as { timestamp: string }).timestamp).toBe('string');
  });

  it('uses console.error for level error and console.warn for level warn', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetchMock.mockResolvedValue({ ok: true } as Response);

    reportEvent('error', 'boom');
    reportEvent('warn', 'careful');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('POSTs the expected JSON body to /api/telemetry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetchMock.mockResolvedValue({ ok: true } as Response);

    reportEvent('error', 'request failed', {
      route: '/providers',
      requestId: 'req-1',
      errorCode: 'NETWORK_ERROR',
    });

    expect(globalThis.fetchMock).toHaveBeenCalledWith(
      '/api/telemetry',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [, init] = globalThis.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      source: 'react',
      level: 'error',
      message: 'request failed',
      route: '/providers',
      requestId: 'req-1',
      errorCode: 'NETWORK_ERROR',
    });
  });

  it('omits undefined context keys from the request body rather than sending null', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    globalThis.fetchMock.mockResolvedValue({ ok: true } as Response);

    reportEvent('info', 'no context');

    const [, init] = globalThis.fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ source: 'react', level: 'info', message: 'no context' });
    expect('route' in body).toBe(false);
    expect('requestId' in body).toBe(false);
    expect('errorCode' in body).toBe(false);
  });

  it('does not throw when the telemetry fetch rejects', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(() => reportEvent('error', 'boom')).not.toThrow();
  });
});

describe('checkApiHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports info when /api/health responds ok', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    globalThis.fetchMock.mockImplementation((url: string) => {
      if (url === '/api/health') {
        return Promise.resolve({ ok: true } as Response);
      }
      return Promise.resolve({ ok: true } as Response);
    });

    checkApiHealth();
    await vi.waitFor(() => expect(infoSpy).toHaveBeenCalled());

    expect(infoSpy.mock.calls[0][0]).toMatchObject({
      level: 'info',
      message: 'backend reachable',
    });
  });

  it('reports error with errorCode HEALTH_CHECK_FAILED when /api/health responds non-ok', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetchMock.mockImplementation((url: string) => {
      if (url === '/api/health') {
        return Promise.resolve({ ok: false } as Response);
      }
      return Promise.resolve({ ok: true } as Response);
    });

    checkApiHealth();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());

    expect(errorSpy.mock.calls[0][0]).toMatchObject({
      level: 'error',
      message: 'backend unreachable',
      errorCode: 'HEALTH_CHECK_FAILED',
    });
  });

  it('reports error with errorCode HEALTH_CHECK_FAILED on a network failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetchMock.mockImplementation((url: string) => {
      if (url === '/api/health') {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({ ok: true } as Response);
    });

    checkApiHealth();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());

    expect(errorSpy.mock.calls[0][0]).toMatchObject({
      level: 'error',
      message: 'backend unreachable',
      errorCode: 'HEALTH_CHECK_FAILED',
    });
  });
});
