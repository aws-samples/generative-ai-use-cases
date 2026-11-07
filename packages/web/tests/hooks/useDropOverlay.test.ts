import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import useDropOverlay, { DRAG_IDLE_MS } from '../../src/hooks/useDropOverlay';

// Minimal React.DragEvent stand-ins; only the fields the hook reads.
const dragEvent = (
  options: {
    types?: string[];
    files?: File[];
    currentTarget?: Element;
    relatedTarget?: EventTarget | null;
  } = {}
) =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      types: options.types ?? ['Files'],
      files: options.files ?? [],
    },
    currentTarget: options.currentTarget ?? document.createElement('div'),
    relatedTarget: options.relatedTarget ?? null,
  }) as unknown as React.DragEvent;

describe('useDropOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the overlay for a file drag but not for a text drag', () => {
    const { result } = renderHook(() => useDropOverlay(vi.fn()));
    act(() =>
      result.current.handleDragOver(dragEvent({ types: ['text/plain'] }))
    );
    expect(result.current.isOver).toBe(false);
    act(() => result.current.handleDragOver(dragEvent()));
    expect(result.current.isOver).toBe(true);
  });

  it('closes when dragover stops arriving (drag released outside the page)', () => {
    const { result } = renderHook(() => useDropOverlay(vi.fn()));
    act(() => result.current.handleDragOver(dragEvent()));
    act(() => vi.advanceTimersByTime(DRAG_IDLE_MS - 100));
    // Still dragging: another dragover keeps it open.
    act(() => result.current.handleDragOver(dragEvent()));
    act(() => vi.advanceTimersByTime(DRAG_IDLE_MS - 100));
    expect(result.current.isOver).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.isOver).toBe(false);
  });

  it('ignores dragleave onto a child of the overlay', () => {
    const { result } = renderHook(() => useDropOverlay(vi.fn()));
    const overlay = document.createElement('div');
    const child = document.createElement('div');
    overlay.appendChild(child);
    act(() => result.current.handleDragOver(dragEvent()));
    act(() =>
      result.current.handleDragLeave(
        dragEvent({ currentTarget: overlay, relatedTarget: child })
      )
    );
    expect(result.current.isOver).toBe(true);
    act(() =>
      result.current.handleDragLeave(
        dragEvent({ currentTarget: overlay, relatedTarget: null })
      )
    );
    expect(result.current.isOver).toBe(false);
  });

  it('closes on Esc', () => {
    const { result } = renderHook(() => useDropOverlay(vi.fn()));
    act(() => result.current.handleDragOver(dragEvent()));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOver).toBe(false);
  });

  it('passes dropped files on and closes', () => {
    const onDropFiles = vi.fn();
    const { result } = renderHook(() => useDropOverlay(onDropFiles));
    const file = new File(['x'], 'a.txt');
    act(() => result.current.handleDragOver(dragEvent()));
    act(() => result.current.handleDrop(dragEvent({ files: [file] })));
    expect(onDropFiles).toHaveBeenCalledWith([file]);
    expect(result.current.isOver).toBe(false);
  });
});
