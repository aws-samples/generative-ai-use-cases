import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

type Props = {
  current: 'agents' | 'skills';
};

// Switches the Agent Builder between its agents and its skills
const AgentBuilderSwitch: React.FC<Props> = ({ current }) => {
  const { t } = useTranslation();
  const items = [
    { key: 'agents', to: '/agent-builder', label: t('agent_builder.agents') },
    {
      key: 'skills',
      to: '/agent-builder/skills',
      label: t('agent_builder.skills'),
    },
  ] as const;

  return (
    <div className="flex rounded border text-sm font-bold">
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          aria-current={current === item.key ? 'page' : undefined}
          className={`m-1 rounded px-3 py-1 ${
            current === item.key
              ? 'bg-gray-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}>
          {item.label}
        </Link>
      ))}
    </div>
  );
};

export default AgentBuilderSwitch;
