import * as React from 'react';

interface SeparatorProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className = '', orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => {
    const baseStyles = 'shrink-0 bg-border';
    const orientationStyles =
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]';
    const combinedClassName =
      `${baseStyles} ${orientationStyles} ${className}`.trim();

    return (
      <div
        ref={ref}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        className={combinedClassName}
        {...props}
      />
    );
  }
);

Separator.displayName = 'Separator';

export { Separator };
