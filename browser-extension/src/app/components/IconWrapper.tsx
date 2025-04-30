import React from 'react';
import { IconType } from 'react-icons';

interface IconWrapperProps {
  icon: IconType;
  className?: string;
  size?: string | number;
  color?: string;
  title?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * IconWrapper component to wrap react-icons v5+ components
 * This component solves the TypeScript error with react-icons v5+ where icons return ReactNode instead of JSX.Element
 */
export const IconWrapper: React.FC<IconWrapperProps> = ({
  icon: Icon,
  className,
  size,
  color,
  title,
  onClick,
  style,
}) => {
  // Use React.createElement to properly render the icon component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return React.createElement(Icon as any, {
    className,
    size,
    color,
    title,
    onClick,
    style,
  });
};
