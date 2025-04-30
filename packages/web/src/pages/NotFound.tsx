import React from 'react';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center">
      {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
      <h1 className="mb-2 text-5xl">404</h1>
      <h2 className="text-aws-smile text-lg">{t('notfound.title')}</h2>
    </div>
  );
};

export default NotFound;
