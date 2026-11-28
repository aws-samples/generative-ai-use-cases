import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiTrash } from 'react-icons/pi';
import ModalDialog from '../ModalDialog';
import Markdown from '../Markdown';
import useAgentMemory, {
  AgentMemories,
} from '../../hooks/agentBuilder/useAgentMemory';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  agentRuntimeArn: string | undefined;
  agentId: string;
  agentName: string;
};

const KINDS: (keyof AgentMemories)[] = ['facts', 'preferences', 'summaries'];

/**
 * What this agent remembers about the signed-in user. The user can delete any
 * one memory, or everything the agent remembers about them.
 */
const AgentMemoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  agentRuntimeArn,
  agentId,
  agentName,
}) => {
  const { t } = useTranslation();
  const { memories, loading, error, load, remove, removeAll } = useAgentMemory(
    agentRuntimeArn,
    agentId
  );
  const [confirmAll, setConfirmAll] = useState(false);
  const [kind, setKind] = useState<keyof AgentMemories>('facts');

  useEffect(() => {
    if (isOpen) {
      setConfirmAll(false);
      setKind('facts');
      load();
    }
  }, [isOpen, load]);

  // Open on a kind that has something to show
  useEffect(() => {
    if (memories && memories[kind].length === 0) {
      const first = KINDS.find((k) => memories[k].length > 0);
      if (first) setKind(first);
    }
    // Only when a new list arrives, not when the user picks a tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories]);

  const total = memories
    ? KINDS.reduce((n, k) => n + memories[k].length, 0)
    : 0;
  const shown = memories?.[kind] ?? [];

  return (
    <ModalDialog
      isOpen={isOpen}
      title={t('agent_builder.memory_title', { name: agentName })}
      onClose={onClose}>
      <div className="flex flex-col gap-3 text-left">
        <p className="text-sm text-gray-600">
          {t('agent_builder.memory_explanation')}
        </p>

        {error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
        )}

        {loading && !memories && (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        )}

        {memories && total === 0 && (
          <p className="text-sm text-gray-500">
            {t('agent_builder.memory_empty')}
          </p>
        )}

        {memories && total > 0 && (
          <>
            {/* One kind at a time, so that there is one list to scroll */}
            <div role="tablist" className="flex gap-1 border-b">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
                    kind === k
                      ? 'border-aws-smile text-aws-font-color font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setKind(k)}>
                  {t('agent_builder.memory_kind_heading', {
                    kind: t(`agent_builder.memory_kind_${k}`),
                    count: memories[k].length,
                  })}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">
                {t('agent_builder.memory_empty')}
              </p>
            ) : (
              <ul
                role="tabpanel"
                className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
                {shown.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-2 rounded border px-2 py-1.5 text-sm">
                    <div className="min-w-0 flex-1 break-words">
                      {kind === 'summaries' ? (
                        <Markdown>{m.text}</Markdown>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      )}
                      {m.createdAt && (
                        <div className="mt-0.5 text-xs text-gray-400">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-40"
                      aria-label={t('agent_builder.memory_delete')}
                      title={t('agent_builder.memory_delete')}
                      disabled={loading}
                      onClick={() => remove(m.id)}>
                      <PiTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          {confirmAll ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-red-700">
                {t('agent_builder.memory_delete_all_confirm')}
              </span>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-40"
                disabled={loading}
                onClick={() => {
                  removeAll();
                  setConfirmAll(false);
                }}>
                {t('agent_builder.memory_delete_all')}
              </button>
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                onClick={() => setConfirmAll(false)}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
              disabled={loading || total === 0}
              onClick={() => setConfirmAll(true)}>
              {t('agent_builder.memory_delete_all')}
            </button>
          )}
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default AgentMemoryModal;
