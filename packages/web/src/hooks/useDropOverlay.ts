import React, { useCallback, useEffect, useRef, useState } from 'react';

// Browsers fire dragover repeatedly while a drag is over the page, even when
// the pointer does not move (at least every ~350 ms per the HTML spec), so a
// gap longer than this means the drag has left or ended.
export const DRAG_IDLE_MS = 1000;

/**
 * State and handlers for a full-screen "drop files here" overlay.
 *
 * The overlay used to close only on dragleave/drop over itself, and could stay
 * on screen after a file was dragged across the page and released elsewhere
 * (#903). dragleave is unreliable for that: it also fires when the pointer
 * moves onto a child of the overlay, and the final one may be delivered to an
 * element that was just re-rendered. So the overlay also closes when dragover
 * stops arriving, and can be closed by hand (Esc, click).
 */
const useDropOverlay = (onDropFiles: (files: File[]) => void) => {
  const [isOver, setIsOver] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  const hideOverlay = useCallback(() => {
    clearTimeout(idleTimer.current);
    setIsOver(false);
  }, []);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  // Esc closes it once the drag has ended and the window has focus (key
  // events are not delivered to the page during a drag).
  useEffect(() => {
    if (!isOver) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideOverlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOver, hideOverlay]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    // Only file drags show the overlay; dragging selected text does not.
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    setIsOver(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIsOver(false), DRAG_IDLE_MS);
  }, []);

  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      // Moving onto a child of the overlay is not leaving it.
      if (
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      ) {
        return;
      }
      hideOverlay();
    },
    [hideOverlay]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      hideOverlay();
      if (event.dataTransfer.files) {
        onDropFiles(Array.from(event.dataTransfer.files));
      }
    },
    [hideOverlay, onDropFiles]
  );

  return { isOver, hideOverlay, handleDragOver, handleDragLeave, handleDrop };
};

export default useDropOverlay;
