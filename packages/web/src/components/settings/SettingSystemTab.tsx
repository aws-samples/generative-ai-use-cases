import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { PiGithubLogoFill, PiArrowSquareOut } from 'react-icons/pi';
import Alert from '../Alert';
import SettingItem from './SettingItem';
import useVersion from '../../hooks/useVersion';
import useGitHub, { PullRequest } from '../../hooks/useGitHub';
import { MODELS } from '../../hooks/useModel';

const ragEnabled: boolean = import.meta.env.VITE_APP_RAG_ENABLED === 'true';
const ragKnowledgeBaseEnabled: boolean =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED === 'true';
const ragKnowledgeBaseStorageType: string =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_STORAGE_TYPE || 'opensearch';
const agentEnabled: boolean = import.meta.env.VITE_APP_AGENT_ENABLED === 'true';

const SettingSystemTab: React.FC = () => {
  const {
    modelRegion,
    modelIds,
    imageGenModelIds,
    videoGenModelIds,
    agentNames,
  } = MODELS;
  const { t } = useTranslation();
  const { getLocalVersion, getHasUpdate } = useVersion();
  const { getClosedPullRequests } = useGitHub();

  const localVersion = getLocalVersion();
  const hasUpdate = getHasUpdate();
  const closedPullRequests = getClosedPullRequests();

  return (
    <>
      {hasUpdate && (
        <div className="mb-5 flex w-full justify-center">
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

      <div className="text-sm">
        <SettingItem
          name={t('setting.items.version')}
          value={localVersion || t('common.not_available')}
          helpMessage={t('setting.items.version_help')}
          top={true}
        />
        <SettingItem
          name={t('setting.items.rag_enabled')}
          value={ragEnabled.toString()}
        />
        <SettingItem
          name={t('setting.items.rag_kb_enabled')}
          value={
            ragKnowledgeBaseEnabled
              ? `true (${ragKnowledgeBaseStorageType === 's3vectors' ? 'Amazon S3 Vectors' : 'OpenSearch Serverless'})`
              : 'false'
          }
        />
        <SettingItem
          name={t('setting.items.agent_enabled')}
          value={agentEnabled.toString()}
        />
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
        <div className="my-2 text-xs">
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

      <div className="mb-3 mt-9 flex items-center justify-center font-semibold">
        <PiGithubLogoFill className="mr-1 text-base" />
        {t('setting.recent_updates')}
      </div>

      <div className="flex w-full flex-col items-center text-sm">
        <ul className="h-64 w-full overflow-y-scroll border border-gray-400 p-2">
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

        <div className="mb-3 mt-1 flex w-full justify-end text-xs">
          <a
            href="https://github.com/aws-samples/generative-ai-use-cases/pulls?q=is%3Apr+is%3Aclosed"
            className="flex items-center hover:underline"
            target="_blank">
            <PiArrowSquareOut className="mr-1 text-base" />
            {t('setting.view_all_updates')}
          </a>
        </div>
      </div>
    </>
  );
};

export default SettingSystemTab;
