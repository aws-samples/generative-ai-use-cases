import useVersion from '../hooks/useVersion';
import useUserSetting from '../hooks/useUserSetting';
import { Link } from 'react-router-dom';
import Help from '../components/Help';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Switch from '../components/Switch';
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
  top?: boolean;
}) => {
  return (
    <div
      className={`border-aws-squid-ink grid grid-cols-12 border-solid px-1 py-2 hover:bg-gray-200 ${props.top ? 'border-y' : 'border-b'}`}>
      <div className="col-span-4 flex items-center justify-start">
        {props.name}
        {props.helpMessage && <Help message={props.helpMessage} />}
      </div>
      <div className="col-span-8 flex items-center justify-end">
        {props.value}
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
  const {
    settingTypingAnimation,
    setSettingTypingAnimation,
    settingShowUseCaseBuilder,
    setSettingShowUseCaseBuilder,
    settingShowTools,
    setSettingShowTools,
    settingShowEmail,
    setSettingShowEmail,
  } = useUserSetting();

  const onClickSignout = useCallback(() => {
    // Delete all SWR cache
    for (const key of cache.keys()) {
      cache.delete(key);
    }
    signOut();
  }, [cache, signOut]);

  return (
    <div className="px-12 lg:px-32 xl:px-64">
      {hasUpdate && (
        <div className="my-5 flex w-full justify-center">
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
        {t('setting.user')}
      </div>

      <div className="text-sm">
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
          top={true}
        />

        <SettingItem
          name={t('setting.items.typing_animation')}
          value={
            <Switch
              checked={settingTypingAnimation}
              label=""
              onSwitch={setSettingTypingAnimation}
            />
          }></SettingItem>

        <SettingItem
          name={t('setting.items.show_use_case_builder')}
          value={
            <Switch
              checked={settingShowUseCaseBuilder}
              label=""
              onSwitch={setSettingShowUseCaseBuilder}
            />
          }></SettingItem>

        <SettingItem
          name={t('setting.items.show_tools')}
          value={
            <Switch
              checked={settingShowTools}
              label=""
              onSwitch={setSettingShowTools}
            />
          }></SettingItem>

        <SettingItem
          name={t('setting.items.show_email')}
          value={
            <Switch
              checked={settingShowEmail}
              label=""
              onSwitch={setSettingShowEmail}
            />
          }></SettingItem>

        <SettingItem
          name={t('setting.items.login_status')}
          value={
            <Button onClick={onClickSignout}>{t('setting.signout')}</Button>
          }></SettingItem>

        <SettingItem
          name={t('setting.items.stats')}
          value={
            <Link to="/stats" className="flex items-center">
              {t('setting.items.stats')}{' '}
              <PiArrowSquareOut className="text-base" />
            </Link>
          }></SettingItem>
      </div>

      <div className="mb-3 mt-9 flex justify-center font-semibold">
        {t('setting.system')}
      </div>

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
          value={ragKnowledgeBaseEnabled.toString()}
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
    </div>
  );
};

export default Setting;
