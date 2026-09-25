import React from 'react';
import { IconType } from 'react-icons';

interface IconWrapperProps extends React.ComponentPropsWithoutRef<'svg'> {
  icon: IconType;
  size?: string | number;
}

/**
 * IconWrapper component to wrap react-icons v5+ components....
 * Cleaned up type checking natively without unsafe type casting.
 */
export const IconWrapper: React.FC<IconWrapperProps> = ({
  icon: Icon,
  ...props
}) => {
  return <Icon {...props} />;
};
