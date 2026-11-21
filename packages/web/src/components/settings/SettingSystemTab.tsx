import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { PiArrowSquareOut, PiNewspaper } from 'react-icons/pi';
import Alert from '../Alert';
import Markdown from '../Markdown';
import SettingItem from './SettingItem';
import useVersion from '../../hooks/useVersion';
import { MODELS } from '../../hooks/useModel';
import { parseReleaseNotes, releasedNotes } from '../../utils/releaseNotes';
// The release notes are the documentation pages, bundled at build time so they
// match the deployed version and need no network access.
import releaseNotesEn from '../../../../../docs/en/RELEASE_NOTES.md?raw';
import releaseNotesJa from '../../../../../docs/ja/RELEASE_NOTES.md?raw';

const DOCS_URL = 'https://aws-samples.github.io/generative-ai-use-cases';
const UPDATE_DOC_URL = {
  en: `${DOCS_URL}/en/UPDATE.html`,
  ja: `${DOCS_URL}/ja/UPDATE.html`,
};
const RELEASE_NOTES_DOC_URL = {
  en: `${DOCS_URL}/en/RELEASE_NOTES.html`,
  ja: `${DOCS_URL}/ja/RELEASE_NOTES.html`,
};
const PARSED_NOTES = {
  en: parseReleaseNotes(releaseNotesEn),
  ja: parseReleaseNotes(releaseNotesJa),
};

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
  const { t, i18n } = useTranslation();
  const { localVersion, latestVersion, hasUpdate } = useVersion();

  // The release notes are written in English and Japanese; other languages
  // show the English page.
  const lang = i18n.resolvedLanguage?.startsWith('ja') ? 'ja' : 'en';
  const notes = useMemo(
    () => releasedNotes(PARSED_NOTES[lang], localVersion),
    [lang, localVersion]
  );

  return (
    <>
      {hasUpdate && (
        <div className="mb-5 flex w-full justify-center">
          <Alert severity="info" className="flex w-fit items-center">
            <Trans
              i18nKey="setting.update.message"
              values={{ version: latestVersion }}
              components={[
                <Link
                  className="text-aws-smile"
                  to={RELEASE_NOTES_DOC_URL[lang]}
                  target="_blank"
                />,
                <Link
                  className="text-aws-smile"
                  to={UPDATE_DOC_URL[lang]}
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
        <PiNewspaper className="mr-1 text-base" />
        {t('setting.release_notes')}
      </div>

      <div className="flex w-full flex-col items-center text-sm">
        <div className="h-96 w-full overflow-y-auto rounded border border-gray-400 p-3">
          {notes.length === 0 ? (
            <div className="text-gray-500">
              {t('setting.release_notes_unavailable')}
            </div>
          ) : (
            notes.map((note) => (
              <section key={note.title} className="mb-4">
                <h3 className="mb-1 text-base font-semibold">{note.title}</h3>
                <Markdown className="prose-sm">{note.highlights}</Markdown>
              </section>
            ))
          )}
        </div>

        <div className="mb-3 mt-1 flex w-full justify-end text-xs">
          <a
            href={RELEASE_NOTES_DOC_URL[lang]}
            className="flex items-center hover:underline"
            target="_blank"
            rel="noreferrer">
            <PiArrowSquareOut className="mr-1 text-base" />
            {t('setting.view_all_release_notes')}
          </a>
        </div>
      </div>
    </>
  );
};

export default SettingSystemTab;
