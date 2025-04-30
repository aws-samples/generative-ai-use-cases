import { Link, useLocation } from 'react-router-dom';
import { BaseProps } from '../@types/common';
import useDrawer from '../hooks/useDrawer';
import { useCallback } from 'react';

export type DrawerItemProps = BaseProps & {
  label: string;
  to: string;
  icon: JSX.Element;
  sub?: string;
};

const DrawerItem: React.FC<DrawerItemProps> = (props) => {
  const location = useLocation();
  const { switchOpen } = useDrawer();

  // If the screen is narrow, close the Drawer when clicked
  const onClick = useCallback(() => {
    if (
      document
        .getElementById('smallDrawerFiller')
        ?.classList.contains('visible')
    ) {
      switchOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      className={`hover:bg-aws-sky mt-0.5 flex h-8 items-center rounded p-2 ${
        location.pathname === props.to && 'bg-aws-sky'
      } ${props.className}`}
      to={props.to}
      onClick={onClick}>
      <span className="mr-2">{props.icon}</span>
      <div className="flex w-full items-center justify-between">
        <span>{props.label}</span>
        {props.sub && (
          <span className="text-xs text-gray-300">{props.sub}</span>
        )}
      </div>
    </Link>
  );
};

export default DrawerItem;
