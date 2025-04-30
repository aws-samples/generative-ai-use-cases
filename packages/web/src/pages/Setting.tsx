import useVersion from '../hooks/useVersion';
import { Link } from 'react-router-dom';
import Help from '../components/Help';
import Alert from '../components/Alert';
import Button from '../components/Button';
import { MODELS } from '../hooks/useModel';
import useGitHub, { PullRequest } from '../hooks/useGitHub';
import { PiGithubLogoFill, PiArrowSquareOut } from 'react-icons/pi';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useTranslation, Trans } from 'react-i18next';
import { supportedLngs } from '../i18n/config';

const ragEnabled: boolean = import.meta.env.VITE_APP_RAG_ENABLED === 'true';
const ragKnowledgeBaseEnabled: boolean =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED === 'true';
const agentEnabled: boolean = import.meta.env.VITE_APP_AGENT_ENABLED === 'true';

const SettingItem = (props: {
  name: string;
  value: string | React.ReactNode;
  helpMessage?: string;
}) => {
  return (
    <div className="border-aws-squid-ink mb-2 w-2/3 border-b-2 border-solid lg:w-1/2">
      <div className="flex justify-between py-0.5">
        <div className="flex items-center">
          {props.name}
          {props.helpMessage && <Help message={props.helpMessage} />}
        </div>
        <div className="text-right">{props.value}</div>
      </div>
    </div>
  );
};

const Setting = () => {
  const {
    modelRegion,
    modelIds,
    imageGenModelIds,
    videoGenModelIds,
    agentNames,
  } = MODELS;
  const { cache } = useSWRConfig();
  const { getLocalVersion, getHasUpdate } = useVersion();
  const { getClosedPullRequests } = useGitHub();
  const { signOut } = useAuthenticator();
  const { i18n, t } = useTranslation();

  const localVersion = getLocalVersion();
  const hasUpdate = getHasUpdate();
  const closedPullRequests = getClosedPullRequests();

  const onClickSignout = useCallback(() => {
    // Delete all SWR cache
    for (const key of cache.keys()) {
      cache.delete(key);
    }
    signOut();
  }, [cache, signOut]);

  return (
    <div>
      <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('setting.title')}
      </div>

      {hasUpdate && (
        <div className="mt-5 flex w-full justify-center">
          <Alert severity="info" className="flex w-fit items-center">
            <Trans
              i18nKey="setting.update.message"
              components={[
                <Link
                  className="text-aws-smile"
                  to="https://github.com/aws-samples/generative-ai-use-cases"
                  target="_blank"
                />,
              ]}
            />
          </Alert>
        </div>
      )}

      <div className="my-3 flex justify-center font-semibold">
        {t('setting.general')}
      </div>

      <div className="flex w-full flex-col items-center text-sm">
        <SettingItem
          name={t('setting.items.version')}
          value={localVersion || t('common.not_available')}
          helpMessage={t('setting.items.version_help')}
        />
        <SettingItem
          name={t('setting.items.rag_enabled')}
          value={ragEnabled.toString()}
        />
        <SettingItem
          name={t('setting.items.rag_kb_enabled')}
          value={ragKnowledgeBaseEnabled.toString()}
        />
        <SettingItem
          name={t('setting.items.agent_enabled')}
          value={agentEnabled.toString()}
        />
        <SettingItem
          name={t('setting.items.language')}
          value={
            <select
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="rounded border border-gray-300 py-1 pr-8 focus:border-gray-300 focus:outline-none focus:ring-0">
              {Object.entries(supportedLngs).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          }
          helpMessage={t('setting.items.language_help')}
        />
      </div>

      <div className="my-3 flex justify-center font-semibold">
        {t('setting.ai')}
      </div>

      <div className="flex w-full flex-col items-center text-sm">
        <SettingItem
          name={t('setting.ai_items.llm_model')}
          value={modelIds.join(', ')}
        />
        <SettingItem
          name={t('setting.ai_items.image_gen_model')}
          value={imageGenModelIds.join(', ')}
        />
        <SettingItem
          name={t('setting.ai_items.video_gen_model')}
          value={videoGenModelIds.join(', ')}
        />
        <SettingItem
          name={t('setting.ai_items.agent_name')}
          value={agentNames.join(', ')}
        />
        <SettingItem
          name={t('setting.ai_items.model_region')}
          value={modelRegion}
        />
        <div className="mt-5 w-2/3 text-xs lg:w-1/2">
          <Trans
            i18nKey="setting.config_message"
            values={{ region: modelRegion }}
            components={[
              <Link
                className="text-aws-smile"
                to="https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/home.html"
                target="_blank"
              />,
              <Link
                className="text-aws-smile"
                to="https://github.com/aws-samples/generative-ai-use-cases"
                target="_blank"
              />,
            ]}
          />
        </div>
      </div>

      <div className="mb-3 mt-8 flex items-center justify-center font-semibold">
        <PiGithubLogoFill className="mr-2 text-lg" />
        {t('setting.recent_updates')}
      </div>

      <div className="flex flex-col items-center text-sm">
        <ul className="h-64 w-2/3 overflow-y-scroll border border-gray-400 p-1 lg:w-1/2">
          {closedPullRequests.map((p: PullRequest, idx: number) => {
            return (
              <li key={idx} className="block truncate text-sm">
                <a href={p.url} className="hover:underline" target="_blank">
                  {p.mergedAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}{' '}
                  {p.title}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-1 flex w-2/3 justify-end text-xs lg:w-1/2">
          <a
            href="https://github.com/aws-samples/generative-ai-use-cases/pulls?q=is%3Apr+is%3Aclosed"
            className="flex items-center hover:underline"
            target="_blank">
            <PiArrowSquareOut className="mr-1 text-base" />
            {t('setting.view_all_updates')}
          </a>
        </div>
      </div>

      <div className="my-10 flex w-full justify-center">
        <Button onClick={onClickSignout} className="text-lg">
          {t('setting.signout')}
        </Button>
      </div>
    </div>
  );
};

export default Setting;
