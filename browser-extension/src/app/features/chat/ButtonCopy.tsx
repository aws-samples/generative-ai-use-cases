import React, { useCallback, useEffect, useState } from 'react';
import { PiCheck, PiCopy } from 'react-icons/pi';
import { IconWrapper } from '../../components/IconWrapper';

// The chat runs in an iframe on the page, where the Clipboard API can be
// unavailable; fall back to copying a selected textarea.
const copyText = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
};

type Props = {
  text: string;
};

const ButtonCopy: React.FC<Props> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const onClick = useCallback(async () => {
    await copyText(text);
    setCopied(true);
  }, [text]);

  return (
    <button
      type="button"
      className="p-1 rounded hover:bg-white/20"
      title={copied ? 'コピーしました' : 'コピー'}
      aria-label={copied ? 'コピーしました' : 'コピー'}
      onClick={onClick}
    >
      <IconWrapper icon={copied ? PiCheck : PiCopy} />
    </button>
  );
};

export default ButtonCopy;
