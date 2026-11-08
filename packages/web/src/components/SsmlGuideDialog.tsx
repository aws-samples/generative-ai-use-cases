import React from 'react';
import { useTranslation } from 'react-i18next';
import { PollyEngine } from 'generative-ai-use-cases';
import ModalDialog from './ModalDialog';
import {
  SSML_ENGINES,
  SSML_TAG_SUPPORT,
  getTagSupport,
} from '../utils/ssmlTags';
import { SSML_GUIDE_ENTRIES } from '../utils/ssmlHelper';

type Props = {
  isOpen: boolean;
  engine: PollyEngine | '';
  onClose: () => void;
  onInsert: (example: string) => void;
};

const focusClassName =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-aws-smile';

const SsmlGuideDialog: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  return (
    <ModalDialog
      isOpen={props.isOpen}
      title={t('textToSpeech.ssml_guide_title')}
      onClose={props.onClose}>
      <div className="flex flex-col gap-4">
        <section aria-labelledby="ssml-guide-howto">
          <h4 id="ssml-guide-howto" className="mb-1 font-bold">
            {t('textToSpeech.ssml_guide_howto_heading')}
          </h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('textToSpeech.ssml_guide_howto_speak')}</li>
            <li>{t('textToSpeech.ssml_guide_howto_closing')}</li>
            <li>{t('textToSpeech.ssml_guide_howto_reserved')}</li>
            <li>{t('textToSpeech.ssml_guide_length')}</li>
          </ul>
        </section>

        <section aria-labelledby="ssml-guide-tags">
          <h4 id="ssml-guide-tags" className="mb-1 font-bold">
            {t('textToSpeech.ssml_guide_engines')}
          </h4>
          <ul className="flex flex-col gap-3">
            {SSML_GUIDE_ENTRIES.map((entry) => {
              const unsupported =
                !!props.engine &&
                getTagSupport(entry.tagId, props.engine) === 'none';
              const reason = unsupported
                ? t('textToSpeech.ssml_tool_unsupported', {
                    tag: entry.tag,
                    engine: props.engine,
                  })
                : undefined;
              return (
                <li key={entry.id} className="rounded border p-2">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <code className="font-bold">{entry.tag}</code>
                    <span>
                      {t(
                        `textToSpeech.ssml_guide_desc_${entry.id.replace(/-/g, '_')}`
                      )}
                    </span>
                  </div>
                  <ul className="my-1 flex flex-wrap gap-x-3 text-xs">
                    {SSML_ENGINES.map((e) => {
                      const support = t(
                        `textToSpeech.ssml_support_${SSML_TAG_SUPPORT[entry.tagId][e]}`
                      );
                      const label = `${e}: ${support}`;
                      return <li key={e}>{label}</li>;
                    })}
                  </ul>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <pre
                      className="min-w-0 flex-1 select-all whitespace-pre-wrap break-all rounded bg-gray-100 p-1.5 text-xs"
                      tabIndex={0}>
                      <code>{entry.example}</code>
                    </pre>
                    <button
                      type="button"
                      className={`shrink-0 rounded border border-black/30 bg-white px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white ${focusClassName}`}
                      disabled={unsupported}
                      title={reason}
                      onClick={() => props.onInsert(entry.example)}>
                      {t('textToSpeech.ssml_guide_insert')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            className={`rounded-lg border border-black/30 bg-white px-3 py-1 hover:bg-gray-100 ${focusClassName}`}
            onClick={props.onClose}>
            {t('textToSpeech.ssml_guide_close')}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default SsmlGuideDialog;
