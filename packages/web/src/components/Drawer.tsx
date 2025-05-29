import React, { useMemo, useState } from 'react';
import { BaseProps } from '../@types/common';
import { useNavigate } from 'react-router-dom';
import { PiMagnifyingGlass, PiGear } from 'react-icons/pi';
import ExpandableMenu from './ExpandableMenu';
import ChatList from './ChatList';
import DrawerItem, { DrawerItemProps } from './DrawerItem';
import DrawerBase from './DrawerBase';
import Switch from './Switch';
import Button from './Button';
import { useTranslation } from 'react-i18next';
import useUserSetting from '../hooks/useUserSetting';

export type ItemProps = DrawerItemProps & {
  display: 'usecase' | 'tool' | 'none';
};

type Props = BaseProps & {
  items: ItemProps[];
};

const Drawer: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settingShowUseCaseBuilder, settingShowTools } = useUserSetting();

  const usecases = useMemo(() => {
    return props.items.filter((i) => i.display === 'usecase');
  }, [props.items]);

  const tools = useMemo(() => {
    return props.items.filter((i) => i.display === 'tool');
  }, [props.items]);

  const [searchQuery, setSearchQuery] = useState('');
  const searchWords = useMemo(() => {
    return searchQuery
      .split(' ')
      .flatMap((q) => q.split('　'))
      .filter((q) => q !== '');
  }, [searchQuery]);

  const useCaseBuilderEnabled: boolean =
    import.meta.env.VITE_APP_USE_CASE_BUILDER_ENABLED === 'true';

  const [settingVisibility, setSettingVisibility] = useState(false);

  return (
    <>
      <DrawerBase>
        {useCaseBuilderEnabled && settingShowUseCaseBuilder && (
          <>
            <Switch
              className="mx-3 my-2"
              label={t('drawer.builder_mode')}
              checked={false}
              onSwitch={() => {
                navigate('/use-case-builder');
              }}
            />
            <div className="border-b" />
          </>
        )}
        <div className="text-aws-smile mx-3 my-1 flex items-center justify-between text-xs">
          <div>
            {t('drawer.use_cases')}{' '}
            <span className="text-gray-400">{t('drawer.generative_ai')}</span>
          </div>
          <PiGear
            className="cursor-pointer text-base text-white"
            onClick={() => {
              setSettingVisibility(!settingVisibility);
            }}
          />
        </div>
        <div className="scrollbar-thin scrollbar-thumb-white ml-2 mr-1 h-full overflow-y-auto">
          {usecases.map((item, idx) => (
            <DrawerItem
              key={idx}
              label={item.label}
              icon={item.icon}
              to={item.to}
              sub={item.sub}
              settingVisibility={settingVisibility}
            />
          ))}

          {settingVisibility && (
            <div className="my-2 flex w-full justify-center">
              <Button
                className="w-full"
                onClick={() => {
                  setSettingVisibility(false);
                }}
                outlined>
                {t('drawer.done')}
              </Button>
            </div>
          )}
        </div>
        <div className="border-b" />
        {tools.length > 0 && settingShowTools && (
          <>
            <ExpandableMenu
              title={t('drawer.tools')}
              subTitle={`(${t('drawer.ai_services')})`}
              className="mx-3 my-2 text-xs">
              <div className="mb-2 ml-2 mr-1">
                {tools.map((item, idx) => (
                  <DrawerItem
                    key={idx}
                    label={item.label}
                    icon={item.icon}
                    to={item.to}
                    sub={item.sub}
                  />
                ))}
              </div>
            </ExpandableMenu>
            <div className="border-b" />
          </>
        )}
        <ExpandableMenu title={t('chat.history')} className="mx-3 my-2 text-xs">
          <div className="relative mb-2 ml-2 mr-1 w-full pl-1.5 pr-7 pt-1">
            <input
              className="bg-aws-squid-ink h-7 w-full rounded-full border border-white pl-8 text-sm text-white focus:border-white focus:ring-0"
              type="text"
              value={searchQuery}
              placeholder={t('chat.search_by_title')}
              onChange={(event) => {
                setSearchQuery(event.target.value ?? '');
              }}
            />
            <PiMagnifyingGlass className="bg-aws-squid-ink absolute left-1.5 top-1 size-7 rounded-l-full border border-white p-1.5" />
          </div>
          <div className="scrollbar-thin scrollbar-thumb-white ml-2 mr-1 h-full overflow-y-auto">
            <ChatList className="mr-1" searchWords={searchWords} />
          </div>
        </ExpandableMenu>
      </DrawerBase>
    </>
  );
};

export default Drawer;
