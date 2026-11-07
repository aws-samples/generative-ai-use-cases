import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';

const useScreenStore = create<{
  isAtBottom: boolean;
  isAtTop: boolean;
  setIsAtBottom: (newIsAtBottom: boolean) => void;
  setIsAtTop: (newIsAtTop: boolean) => void;
  scrollTopAnchor: HTMLDivElement | null;
  scrollBottomAnchor: HTMLDivElement | null;
  setScrollTopAnchor: (newScrollTopAnchor: HTMLDivElement | null) => void;
  setScrollBottomAnchor: (newScrollBottomAnchor: HTMLDivElement | null) => void;
}>((set) => {
  const setIsAtBottom = (newIsAtBottom: boolean) => {
    set(() => {
      return {
        isAtBottom: newIsAtBottom,
      };
    });
  };

  const setIsAtTop = (newIsAtTop: boolean) => {
    set(() => {
      return {
        isAtTop: newIsAtTop,
      };
    });
  };

  const setScrollTopAnchor = (newScrollTopAnchor: HTMLDivElement | null) => {
    set(() => {
      return {
        scrollTopAnchor: newScrollTopAnchor,
      };
    });
  };

  const setScrollBottomAnchor = (
    newScrollBottomAnchor: HTMLDivElement | null
  ) => {
    set(() => {
      return {
        scrollBottomAnchor: newScrollBottomAnchor,
      };
    });
  };

  return {
    isAtBottom: false,
    isAtTop: false,
    setIsAtBottom,
    setIsAtTop,
    scrollTopAnchor: null,
    scrollBottomAnchor: null,
    setScrollTopAnchor,
    setScrollBottomAnchor,
  };
});

const isScrollContainer = (el: HTMLElement): boolean => {
  const overflowY = window.getComputedStyle(el).overflowY;
  return overflowY === 'auto' || overflowY === 'scroll';
};

// Scroll the container that holds `anchor` to its top or bottom edge. The
// anchors live in the `overflow-y-scroll` screen div in App.tsx; containers
// with `overflow: hidden` are not treated as scroll containers.
//
// `anchor.scrollIntoView()` scrolls every scrollable ancestor, and that
// includes the parent page when GenU is embedded in an iframe: sending a chat
// message jumped the host page down (#1288). Setting `scrollTop` on the
// container only moves GenU's own scroll area.
export const scrollToEdge = (anchor: HTMLElement, edge: 'top' | 'bottom') => {
  let container = anchor.parentElement;
  while (container && !isScrollContainer(container)) {
    container = container.parentElement;
  }
  const target =
    container ?? document.scrollingElement ?? document.documentElement;
  target.scrollTop = edge === 'top' ? 0 : target.scrollHeight;
};

const useScreen = () => {
  const {
    isAtBottom,
    isAtTop,
    setIsAtBottom,
    setIsAtTop,
    scrollTopAnchor,
    setScrollTopAnchor,
    scrollBottomAnchor,
    setScrollBottomAnchor,
  } = useScreenStore();

  const screen = useRef<HTMLDivElement>(null);

  // A function to notify when the screen size or position changes
  // It is called when the screen is initially loaded and when scrolling
  // When the chat elements are loaded, the screen is automatically scrolled to the bottom, so it is also called there
  const notifyScreen = useCallback(
    (div: HTMLDivElement) => {
      // When the bottom is reached, set isAtBottom to true
      // Because the decimal point may be omitted, 1.0 is provided as a margin
      if (div.clientHeight + div.scrollTop + 1.0 >= div.scrollHeight) {
        setIsAtBottom(true);
      } else {
        setIsAtBottom(false);
      }

      // When the top is reached, set isAtTop to true
      // Because the decimal point may be omitted, 1.0 is provided as a margin
      if (div.scrollTop <= 1.0) {
        setIsAtTop(true);
      } else {
        setIsAtTop(false);
      }
    },
    [setIsAtBottom, setIsAtTop]
  );

  // When the screen (defined in App.tsx) is set, set the scroll event listener
  useEffect(() => {
    const current = screen.current;

    if (!current) return;

    const handleScrollInner = () => {
      notifyScreen(current);
    };

    screen.current.addEventListener('scroll', handleScrollInner);
    notifyScreen(current);

    return () => {
      current.removeEventListener('scroll', handleScrollInner);
    };
  }, [screen, notifyScreen]);

  const scrollTopAnchorRef = useRef(null);
  const scrollBottomAnchorRef = useRef(null);

  useEffect(() => {
    if (scrollTopAnchorRef.current) {
      setScrollTopAnchor(scrollTopAnchorRef.current);
    }
  }, [scrollTopAnchorRef, setScrollTopAnchor]);

  useEffect(() => {
    if (scrollBottomAnchorRef.current) {
      setScrollBottomAnchor(scrollBottomAnchorRef.current);
    }
  }, [scrollBottomAnchorRef, setScrollBottomAnchor]);

  const scrollToBottom = useCallback(() => {
    if (scrollBottomAnchor) {
      scrollToEdge(scrollBottomAnchor, 'bottom');
    }
  }, [scrollBottomAnchor]);

  const scrollToTop = useCallback(() => {
    if (scrollTopAnchor) {
      scrollToEdge(scrollTopAnchor, 'top');
    }
  }, [scrollTopAnchor]);

  return {
    screen,
    notifyScreen,
    isAtBottom,
    isAtTop,
    setIsAtBottom,
    setIsAtTop,
    scrollTopAnchorRef,
    scrollBottomAnchorRef,
    scrollToBottom,
    scrollToTop,
  };
};

export default useScreen;
