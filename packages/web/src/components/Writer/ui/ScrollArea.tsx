import * as React from 'react';

interface ScrollAreaProps extends React.HTMLProps<HTMLDivElement> {
  className?: string;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`relative overflow-auto ${className}`}
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
      }}
      {...props}>
      {children}
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
