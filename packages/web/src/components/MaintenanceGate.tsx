import React from 'react';
import { useTranslation } from 'react-i18next';
import { PiWrench } from 'react-icons/pi';
import { useMaintenance } from '../hooks/useMaintenance';

type Props = {
  children: React.ReactNode;
};

/**
 * Replace the whole application with a notice while the maintenance flag is set.
 *
 * The children are rendered until the first check completes, so a slow or failing
 * request never blocks access.
 */
const MaintenanceGate: React.FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const { maintenance, message } = useMaintenance();

  if (!maintenance) {
    return <>{children}</>;
  }

  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <PiWrench className="text-aws-smile text-5xl" />
      <h1 className="text-aws-font-color text-2xl font-bold">
        {t('maintenance.title')}
      </h1>
      <p className="text-aws-font-color/70 max-w-xl whitespace-pre-wrap">
        {message || t('maintenance.description')}
      </p>
    </div>
  );
};

export default MaintenanceGate;
