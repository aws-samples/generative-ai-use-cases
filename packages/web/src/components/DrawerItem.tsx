import { Link, useLocation } from 'react-router-dom';
import { BaseProps } from '../@types/common';
import useDrawer from '../hooks/useDrawer';
import { useCallback } from 'react';
import Switch from '../components/Switch';
import useLocalStorageBoolean from '../hooks/useLocalStorageBoolean';

export type DrawerItemProps = BaseProps & {
  label: string;
  to: string;
  icon: JSX.Element;
  sub?: string;
  settingVisibility?: boolean;
};

const DrawerItem: React.FC<DrawerItemProps> = (props) => {
  const location = useLocation();
  const { switchOpen } = useDrawer();
  const [visibility, setVisibility] = useLocalStorageBoolean(
    `visibility_${props.to}`,
    true
  );

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
    <>
      {!visibility && !props.settingVisibility ? (
        <div></div>
      ) : (
        <div className="mt-0.5 flex h-8 items-center">
          {props.settingVisibility && (
            <Switch checked={visibility} onSwitch={setVisibility} label="" />
          )}
          <Link
            className={`hover:bg-aws-sky flex h-8 w-full items-center rounded p-2 ${
              location.pathname === props.to && 'bg-aws-sky'
            } ${props.className} ${props.settingVisibility ? 'pl-2' : ''}`}
            to={props.to}
            onClick={onClick}>
            {!props.settingVisibility && (
              <span className="mr-2">{props.icon}</span>
            )}
            <div className="flex w-full items-center justify-between">
              <span>{props.label}</span>
              {props.sub && (
                <span className="text-xs text-gray-300">{props.sub}</span>
              )}
            </div>
          </Link>
        </div>
      )}
    </>
  );
};

export default DrawerItem;
