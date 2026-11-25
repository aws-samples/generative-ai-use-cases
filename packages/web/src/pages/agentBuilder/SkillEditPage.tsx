import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { PiArrowLeft as BackIcon, PiTrash as DeleteIcon } from 'react-icons/pi';
import {
  AGENT_SKILL_DESCRIPTION_MAX_LENGTH,
  AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH,
  AGENT_SKILL_NAME_MAX_LENGTH,
  isValidAgentSkillName,
} from '@generative-ai-use-cases/common';
import Button from '../../components/Button';
import InputText from '../../components/InputText';
import Textarea from '../../components/Textarea';
import Markdown from '../../components/Markdown';
import ModalDialog from '../../components/ModalDialog';
import {
  useSkill,
  useSkillApi,
  useSkillList,
} from '../../hooks/agentBuilder/useAgentSkills';
import { agentReturnPath } from '../../utils/agentDraft';
import useLeaveGuard from '../../hooks/useLeaveGuard';

const errorMessage = (err: unknown): string | undefined => {
  const data = (err as { response?: { data?: { error?: string } } })?.response
    ?.data;
  return data?.error;
};

type SkillForm = { name: string; description: string; instructions: string };
const EMPTY: SkillForm = { name: '', description: '', instructions: '' };

// The fields in order, with their limits and texts
const FIELDS = [
  { key: 'name', max: AGENT_SKILL_NAME_MAX_LENGTH, rows: 0 },
  { key: 'description', max: AGENT_SKILL_DESCRIPTION_MAX_LENGTH, rows: 3 },
  { key: 'instructions', max: AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH, rows: 16 },
] as const;

const SkillEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { skillId } = useParams<{ skillId?: string }>();
  const isEditMode = Boolean(skillId);

  const { skill, isLoading, error: loadError } = useSkill(skillId);
  const { mutate: mutateList } = useSkillList();
  const { createSkill, updateSkill, deleteSkill } = useSkillApi();

  const [form, setForm] = useState<SkillForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (skill) {
      const { name, description, instructions } = skill;
      setForm({ name, description, instructions });
    }
  }, [skill]);

  const nameIsValid = isValidAgentSkillName(form.name);
  const isValid =
    nameIsValid &&
    FIELDS.every(({ key, max }) => {
      const length = form[key].trim().length;
      return length > 0 && length <= max;
    });

  const saved = skill ?? EMPTY;
  const guard = useLeaveGuard(
    FIELDS.some(({ key }) => form[key] !== saved[key])
  );

  // Opened from an agent being edited: go back to it, where its draft waits
  const [searchParams] = useSearchParams();
  const returnTo = agentReturnPath(searchParams.get('returnTo'));
  const backToList = (addedSkillId?: string) =>
    returnTo
      ? navigate(returnTo, { state: addedSkillId ? { addedSkillId } : null })
      : navigate('/agent-builder/skills');

  // Saving and deleting go back the same way; a skill created for the agent
  // being edited is added to it
  const run = async (
    action: () => Promise<string | void>,
    failedKey: string
  ) => {
    setSaving(true);
    setError(null);
    try {
      const addedSkillId = (await action()) || undefined;
      await mutateList();
      guard.leave();
      backToList(addedSkillId);
    } catch (err) {
      setError(errorMessage(err) ?? t(failedKey));
      setShowDeleteDialog(false);
    } finally {
      setSaving(false);
    }
  };
  const handleSave = () =>
    run(async () => {
      if (!skillId) return (await createSkill(form)).skillId;
      await updateSkill(skillId, form);
    }, 'agent_builder.skill_save_failed');
  const handleDelete = () =>
    run(async () => {
      await deleteSkill(skillId!);
    }, 'agent_builder.skill_delete_failed');

  if (isEditMode && loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">
          {t('agent_builder.skill_not_found')}
        </p>
        <Button outlined onClick={() => backToList()}>
          <BackIcon className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const agents = skill?.agents ?? [];

  return (
    <div className="w-full px-8 py-8">
      {guard.dialog}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button outlined onClick={() => backToList()}>
            <BackIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('common.back')}</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode
              ? t('agent_builder.edit_skill')
              : t('agent_builder.create_skill')}
          </h1>
        </div>
        {isEditMode && (
          <Button
            outlined
            onClick={() => setShowDeleteDialog(true)}
            disabled={saving || isLoading}>
            <DeleteIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('common.delete')}</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border bg-white p-6">
            {FIELDS.map(({ key, max, rows }) => {
              const Input = rows ? Textarea : InputText;
              const length = form[key].trim().length;
              const invalid = key === 'name' && form.name && !nameIsValid;
              return (
                <div key={key}>
                  <Input
                    label={t(`agent_builder.skill_${key}`)}
                    value={form[key]}
                    onChange={(value: string) =>
                      setForm((f) => ({ ...f, [key]: value }))
                    }
                    placeholder={
                      key === 'name'
                        ? 'weekly-report'
                        : t(`agent_builder.skill_${key}_placeholder`)
                    }
                    rows={rows || undefined}
                    required
                  />
                  <div className="flex justify-between gap-2">
                    <p
                      className={`text-xs ${invalid ? 'text-red-600' : 'text-gray-500'}`}>
                      {t(`agent_builder.skill_${key}_hint`)}
                    </p>
                    <span
                      className={`shrink-0 whitespace-nowrap text-xs ${length > max ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                      {t('agent_builder.skill_character_count', {
                        length: length.toLocaleString(),
                        max: max.toLocaleString(),
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3">
            <Button outlined onClick={() => backToList()} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isValid || saving || isLoading}>
              {isEditMode ? t('common.update') : t('common.create')}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {t('agent_builder.skill_preview')}
            </h2>
            {form.instructions.trim() ? (
              <Markdown>{form.instructions}</Markdown>
            ) : (
              <p className="text-sm text-gray-400">
                {t('agent_builder.skill_preview_empty')}
              </p>
            )}
          </div>

          {isEditMode && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">
                {t('agent_builder.agents_using_skill')}
              </h2>
              {agents.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {t('agent_builder.no_agents_using_skill')}
                </p>
              ) : (
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {agents.map((agent) => (
                    <li key={agent.agentId}>
                      <Link
                        to={`/agent-builder/${encodeURIComponent(agent.agentId)}/edit`}
                        className="text-aws-smile hover:underline">
                        {agent.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalDialog
        isOpen={showDeleteDialog}
        title={t('agent_builder.delete_skill')}
        onClose={() => setShowDeleteDialog(false)}>
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('agent_builder.delete_skill_confirm', { name: form.name })}
          </p>
          {agents.length > 0 && (
            <div className="text-sm text-gray-700">
              <p className="mb-1">
                {t('agent_builder.delete_skill_agents_affected')}
              </p>
              <ul className="list-inside list-disc">
                {agents.map((agent) => (
                  <li key={agent.agentId}>{agent.name}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button outlined onClick={() => setShowDeleteDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDelete} disabled={saving}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};

export default SkillEditPage;
