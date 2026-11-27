import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMaintenance } from '../../src/hooks/useMaintenance';

const mockFetch = vi.fn();

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useMaintenance', () => {
  it('reports maintenance when the flag is true', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ maintenance: true }));

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(result.current.maintenance).toBe(true));
  });

  it('reports no maintenance when the flag is false', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ maintenance: false }));

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current.maintenance).toBe(false);
  });

  it('exposes an operator supplied message', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ maintenance: true, message: 'Back at 10:00 JST' })
    );

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(result.current.maintenance).toBe(true));
    expect(result.current.message).toBe('Back at 10:00 JST');
  });

  it('ignores a message that is not a string', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ maintenance: true, message: { ja: 'x' } })
    );

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(result.current.maintenance).toBe(true));
    expect(result.current.message).toBeUndefined();
  });

  it('requests the flag with no-store so the browser cache is bypassed', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ maintenance: false }));

    renderHook(() => useMaintenance());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('maintenance.json'),
      { cache: 'no-store' }
    );
  });

  // Failing open matters: a single failed request must not lock everyone out
  it('reports no maintenance when the request rejects', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current.maintenance).toBe(false);
  });

  it('reports no maintenance on a non-ok response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ maintenance: true }, false));

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current.maintenance).toBe(false);
  });

  // A missing file is rewritten to index.html with status 200 by CloudFront
  it('reports no maintenance when the response is not JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      json: async () => ({ maintenance: true }),
    });

    const { result } = renderHook(() => useMaintenance());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current.maintenance).toBe(false);
  });

  it('picks up a flag that is turned on after the first check', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(jsonResponse({ maintenance: false }));

    const { result } = renderHook(() => useMaintenance());
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.maintenance).toBe(false);

    mockFetch.mockResolvedValue(jsonResponse({ maintenance: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(result.current.maintenance).toBe(true);
  });

  it('re-checks when the tab becomes visible again', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ maintenance: false }));

    renderHook(() => useMaintenance());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
