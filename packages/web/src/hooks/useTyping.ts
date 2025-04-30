import { useEffect, useMemo, useState } from 'react';

const TYPING_DELAY = 10;

const useTyping = (typing?: boolean) => {
  const [typingTextInput, setTypingTextInput] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (typing) {
      // When the animation starts
      if (!animating) {
        setAnimating(true);
      }
    } else {
      // When the animation is completed or when the animation is not specified from the beginning
      if (!animating) {
        setCurrentIndex(0);
      }
    }
  }, [typing, animating, setAnimating, setCurrentIndex]);

  // The number of remaining characters that need to be input
  const remainingTextLength = useMemo(() => {
    return typingTextInput.length - currentIndex;
  }, [currentIndex, typingTextInput]);

  // The unit of the number of characters to input at a time
  const inputUnit = useMemo(() => {
    // If typing, change the number of input characters according to the number of remaining characters
    // The unit of the number of input characters is at most 10 characters
    if (typing) {
      return Math.min(Math.floor(remainingTextLength / 10) + 1, 10);
    } else {
      // If not typing, input 10 characters at a time (the fastest input)
      return 10;
    }
  }, [typing, remainingTextLength]);

  useEffect(() => {
    if (animating && currentIndex <= typingTextInput.length + 1) {
      const timeout = setTimeout(() => {
        if (currentIndex < typingTextInput.length + 1) {
          setCurrentIndex(currentIndex + inputUnit);
        } else {
          // When the input string reaches the end, if typing is false, end the animation
          if (!typing) {
            setAnimating(false);
          }
        }
      }, TYPING_DELAY);

      return () => clearTimeout(timeout);
    }
  }, [
    typingTextInput,
    currentIndex,
    animating,
    typing,
    setCurrentIndex,
    setAnimating,
    inputUnit,
  ]);

  const typingTextOutput = useMemo(() => {
    if (animating) {
      return typingTextInput.slice(0, currentIndex);
    } else {
      // If animating is false, return typingTextInput as is
      return typingTextInput;
    }
  }, [typingTextInput, currentIndex, animating]);

  return {
    setTypingTextInput,
    typingTextOutput,
  };
};

export default useTyping;
