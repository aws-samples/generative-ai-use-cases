import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PiChartBar, PiGear, PiInfo, PiUser } from 'react-icons/pi';
import IconWithDot from '../components/IconWithDot';
import SettingGeneralTab from '../components/settings/SettingGeneralTab';
import SettingAccountTab from '../components/settings/SettingAccountTab';
import SettingSystemTab from '../components/settings/SettingSystemTab';
import StatPage from './StatPage';
import useVersion from '../hooks/useVersion';

type TabId = 'general' | 'usage' | 'account' | 'system';

type TabDef = {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
};

const TABS: TabDef[] = [
  { id: 'general', labelKey: 'setting.tabs.general', icon: <PiGear /> },
  { id: 'usage', labelKey: 'setting.tabs.usage', icon: <PiChartBar /> },
  { id: 'account', labelKey: 'setting.tabs.account', icon: <PiUser /> },
  { id: 'system', labelKey: 'setting.tabs.system', icon: <PiInfo /> },
];

const Setting: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getHasUpdate } = useVersion();
  const hasUpdate = getHasUpdate();

  const activeTab = useMemo<TabId>(() => {
    const tab = searchParams.get('tab');
    return TABS.find((td) => td.id === tab)?.id ?? 'general';
  }, [searchParams]);

  const setTab = (tabId: TabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col lg:min-h-screen lg:flex-row">
      {/* Tabs: a row on a phone, a column on a wide screen */}
      <nav
        role="tablist"
        className="flex flex-none flex-row overflow-x-auto border-b border-gray-300 lg:w-48 lg:flex-col lg:border-b-0 lg:border-r lg:py-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setTab(tab.id)}
            className={`flex flex-none items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-200 font-semibold'
                : 'hover:text-aws-font-color text-gray-500 hover:bg-gray-100'
            }`}>
            <IconWithDot showDot={tab.id === 'system' && hasUpdate}>
              <span className="text-base">{tab.icon}</span>
            </IconWithDot>
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div role="tabpanel" className="min-w-0 flex-1">
        {activeTab === 'usage' ? (
          <StatPage />
        ) : (
          <div className="mx-auto max-w-4xl px-6 py-6 lg:px-12">
            {activeTab === 'general' && <SettingGeneralTab />}
            {activeTab === 'account' && <SettingAccountTab />}
            {activeTab === 'system' && <SettingSystemTab />}
          </div>
        )}
      </div>
    </div>
  );
};

export default Setting;
