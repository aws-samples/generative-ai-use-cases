import React, { useMemo } from 'react';
import { TextWithHighlights, Highlight } from '@aws-sdk/client-kendra';

type Props = {
  textWithHighlights: TextWithHighlights;
};

const HighlightText: React.FC<Props> = (props) => {
  const highlightText = useMemo(() => {
    const baseText: string = props.textWithHighlights.Text || '';
    const highlights: Highlight[] = props.textWithHighlights.Highlights || [];

    if (highlights.length === 0) {
      return <>{baseText}</>;
    }

    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < highlights.length; i++) {
      // Highlight text between start and mid (between the previous End and Begin)
      // Highlight text between mid and end (between Begin and End)
      const start = highlights[i - 1]?.EndOffset ?? 0;
      const mid = highlights[i]?.BeginOffset ?? baseText.length;
      const end = highlights[i]?.EndOffset ?? baseText.length;

      nodes.push(
        <React.Fragment key={`${i}-1`}>
          {baseText.substring(start, mid)}{' '}
        </React.Fragment>,
        <span key={`${i}-2`} className="font-bold text-gray-700">
          {baseText.substring(mid, end)}
        </span>
      );
      // After processing all highlights, set the remaining string together
      if (i === highlights.length - 1) {
        nodes.push(
          <React.Fragment key={`${i}-3`}>
            {baseText.substring(end)}
          </React.Fragment>
        );
      }
    }

    return <div className="text-gray-600">{nodes}</div>;
  }, [props]);

  return highlightText;
};

export default HighlightText;
