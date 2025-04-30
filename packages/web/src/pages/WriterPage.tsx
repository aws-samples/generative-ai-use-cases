import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import queryString from 'query-string';
import { WriterPageQueryParams } from '../@types/navigate';
import { useTranslation } from 'react-i18next';

const TailwindAdvancedEditor = lazy(
  () => import('../components/Writer/AdvancedEditor')
);

const WriterPage: React.FC = () => {
  const { search } = useLocation();
  const { t } = useTranslation();

  // Get initial value from URL parameters
  const initialSentence = React.useMemo(() => {
    if (search === '') return '';
    const params = queryString.parse(search) as WriterPageQueryParams;
    return params.sentence ?? '';
  }, [search]);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('writer.title')}
      </div>
      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <div className="m-auto max-w-full p-2">
          <Suspense fallback={<div>{t('common.loading')}</div>}>
            <TailwindAdvancedEditor initialSentence={initialSentence} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default WriterPage;
