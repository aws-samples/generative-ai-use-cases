import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PollyEngine } from 'generative-ai-use-cases';
import Tooltip from './Tooltip';
import { SsmlTagId, getTagSupport, tagLabel } from '../utils/ssmlTags';
import {
  LANG_OPTIONS,
  PAUSE_OPTIONS,
  PROSODY_OPTIONS,
  SayAsType,
  TOOLBAR_TAGS,
  getDateFormat,
  getPhonemeAlphabets,
  getSayAsTypes,
} from '../utils/ssmlHelper';
import { TextEdit, insertAtCursor, wrapSelection } from '../utils/ssmlSnippet';

export type SsmlEditFn = (
  value: string,
  start: number,
  end: number
) => TextEdit;

type Props = {
  engine: PollyEngine | '';
  languageCode: string;
  onEdit: (edit: SsmlEditFn) => void;
};

const selectClassName =
  'min-w-[6.5rem] shrink-0 rounded border border-black/30 bg-white py-1 pl-2 pr-8 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aws-smile';
const buttonClassName =
  'shrink-0 whitespace-nowrap rounded border border-black/30 bg-white px-2 py-1 text-sm hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-aws-smile disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white';

const ToolButton: React.FC<{
  engine: PollyEngine | '';
  tagId: SsmlTagId;
  tagName: string;
  label: string;
  onClick: () => void;
}> = (p) => {
  const { t } = useTranslation();
  // A button is disabled when the selected engine does not support the tag
  const reason =
    p.engine && getTagSupport(p.tagId, p.engine) === 'none'
      ? t('textToSpeech.ssml_tool_unsupported', {
          tag: tagLabel({ name: p.tagName, attrs: {} }),
          engine: p.engine,
        })
      : '';
  const button = (
    <button
      type="button"
      className={buttonClassName}
      disabled={reason !== ''}
      title={reason || undefined}
      onClick={p.onClick}>
      {p.label}
    </button>
  );
  return reason ? (
    <Tooltip message={reason} position="right" topPosition="-top-10">
      {button}
    </Tooltip>
  ) : (
    button
  );
};

const SsmlToolbar: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { engine, languageCode, onEdit } = props;

  const [pause, setPause] = useState('500ms');
  const [sayAs, setSayAs] = useState<SayAsType>('digits');
  const [alphabet, setAlphabet] = useState('');
  const [prosody, setProsody] = useState(PROSODY_OPTIONS[0].id);
  const [lang, setLang] = useState('en-US');

  const sayAsTypes = useMemo(() => getSayAsTypes(languageCode), [languageCode]);
  const alphabets = useMemo(
    () => getPhonemeAlphabets(languageCode),
    [languageCode]
  );
  // Keep the selection valid for the language (e.g. telephone only for some languages)
  const currentSayAs = sayAsTypes.includes(sayAs) ? sayAs : sayAsTypes[0];
  const currentAlphabet = alphabets.includes(alphabet)
    ? alphabet
    : alphabets[0];

  const placeholderText = t('textToSpeech.ssml_placeholder_text');

  const group = 'flex shrink-0 items-center gap-1';

  return (
    <div
      role="toolbar"
      aria-label={t('textToSpeech.ssml_toolbar_label')}
      className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className={group}>
        <select
          className={selectClassName}
          aria-label={t('textToSpeech.ssml_option_pause')}
          value={pause}
          onChange={(e) => setPause(e.target.value)}>
          {PAUSE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.pause}
          tagName="break"
          label={t('textToSpeech.ssml_tool_pause')}
          onClick={() =>
            onEdit((v, s, e) =>
              insertAtCursor(v, s, e, `<break time="${pause}"/>`)
            )
          }
        />
      </div>

      <div className={group}>
        <select
          className={selectClassName}
          aria-label={t('textToSpeech.ssml_option_say_as')}
          value={currentSayAs}
          onChange={(e) => setSayAs(e.target.value as SayAsType)}>
          {sayAsTypes.map((o) => (
            <option key={o} value={o}>
              {t(`textToSpeech.ssml_say_as_${o}`)}
            </option>
          ))}
        </select>
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.sayAs}
          tagName="say-as"
          label={t('textToSpeech.ssml_tool_say_as')}
          onClick={() =>
            onEdit((v, s, e) =>
              wrapSelection(
                v,
                s,
                e,
                `<say-as interpret-as="${currentSayAs}"${
                  currentSayAs === 'date'
                    ? ` format="${getDateFormat(languageCode)}"`
                    : ''
                }>`,
                '</say-as>',
                placeholderText
              )
            )
          }
        />
      </div>

      <ToolButton
        engine={engine}
        tagId={TOOLBAR_TAGS.sub}
        tagName="sub"
        label={t('textToSpeech.ssml_tool_sub')}
        onClick={() => {
          const alias = t('textToSpeech.ssml_placeholder_alias');
          onEdit((v, s, e) =>
            wrapSelection(
              v,
              s,
              e,
              `<sub alias="${alias}">`,
              '</sub>',
              placeholderText,
              alias
            )
          );
        }}
      />

      <div className={group}>
        <select
          className={selectClassName}
          aria-label={t('textToSpeech.ssml_option_alphabet')}
          value={currentAlphabet}
          onChange={(e) => setAlphabet(e.target.value)}>
          {alphabets.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.phoneme}
          tagName="phoneme"
          label={t('textToSpeech.ssml_tool_phoneme')}
          onClick={() => {
            const ph = t('textToSpeech.ssml_placeholder_reading');
            onEdit((v, s, e) =>
              wrapSelection(
                v,
                s,
                e,
                `<phoneme alphabet="${currentAlphabet}" ph="${ph}">`,
                '</phoneme>',
                placeholderText,
                ph
              )
            );
          }}
        />
      </div>

      <div className={group}>
        <select
          className={selectClassName}
          aria-label={t('textToSpeech.ssml_option_prosody')}
          value={prosody}
          onChange={(e) => setProsody(e.target.value)}>
          {PROSODY_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {t(`textToSpeech.ssml_prosody_${o.id.replace('-', '_')}`)}
            </option>
          ))}
        </select>
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.prosody}
          tagName="prosody"
          label={t('textToSpeech.ssml_tool_prosody')}
          onClick={() => {
            const option =
              PROSODY_OPTIONS.find((o) => o.id === prosody) ??
              PROSODY_OPTIONS[0];
            onEdit((v, s, e) =>
              wrapSelection(
                v,
                s,
                e,
                `<prosody ${option.attribute}>`,
                '</prosody>',
                placeholderText
              )
            );
          }}
        />
      </div>

      <div className={group}>
        <select
          className={selectClassName}
          aria-label={t('textToSpeech.ssml_option_lang')}
          value={lang}
          onChange={(e) => setLang(e.target.value)}>
          {LANG_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.lang}
          tagName="lang"
          label={t('textToSpeech.ssml_tool_lang')}
          onClick={() =>
            onEdit((v, s, e) =>
              wrapSelection(
                v,
                s,
                e,
                `<lang xml:lang="${lang}">`,
                '</lang>',
                placeholderText
              )
            )
          }
        />
      </div>

      <div className={group}>
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.paragraph}
          tagName="p"
          label={t('textToSpeech.ssml_tool_paragraph')}
          onClick={() =>
            onEdit((v, s, e) =>
              wrapSelection(v, s, e, '<p>', '</p>', placeholderText)
            )
          }
        />
        <ToolButton
          engine={engine}
          tagId={TOOLBAR_TAGS.sentence}
          tagName="s"
          label={t('textToSpeech.ssml_tool_sentence')}
          onClick={() =>
            onEdit((v, s, e) =>
              wrapSelection(v, s, e, '<s>', '</s>', placeholderText)
            )
          }
        />
      </div>
    </div>
  );
};

export default SsmlToolbar;
