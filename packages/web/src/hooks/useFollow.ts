import { useRef, useEffect, useState } from 'react';
import useScreen from './useScreen';

const useFollow = () => {
  const { isAtBottom, scrollToBottom } = useScreen();

  // The element that contains the scrollable element
  // The size is expected to be dynamic
  // In the case of the chat page, it is an element that wraps the message
  const scrollableContainer = useRef<HTMLDivElement>(null);

  // Whether to follow or not
  // If the page is at the bottom, follow
  // Otherwise (if manually scrolled up), do not follow
  const [following, setFollowing] = useState(true);

  // Monitor the size change of scrollableContainer
  useEffect(() => {
    if (scrollableContainer.current) {
      const observer = new ResizeObserver(() => {
        // If the screen size changes, follow
        if (following) {
          scrollToBottom();
        }
      });

      observer.observe(scrollableContainer.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [following, scrollToBottom]);

  // If the page is at the bottom, set following to true
  // If manually scrolled up, set following to false
  useEffect(() => {
    setFollowing(isAtBottom);
  }, [isAtBottom, setFollowing]);

  return {
    setFollowing,
    scrollableContainer,
  };
};

export default useFollow;
