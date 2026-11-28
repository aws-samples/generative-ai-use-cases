import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AgentSkillSummary } from 'generative-ai-use-cases';
import { AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH } from '@generative-ai-use-cases/common';
import { PiPlus as AddIcon, PiX as RemoveIcon } from 'react-icons/pi';
import Button from '../Button';
import ButtonIcon from '../ButtonIcon';
import InputText from '../InputText';
import ModalDialog from '../ModalDialog';
import { searchSkills, skillsOfAgent } from '../../utils/agentSkills';
import { skillPagePath } from '../../utils/agentDraft';

type Props = {
  skills: AgentSkillSummary[];
  isLoading: boolean;
  skillIds: string[];
  onChange: (skillIds: string[]) => void;
  disabled?: boolean;
  // The page that a skill page comes back to, and what to do before leaving
  // for it (keeping the agent being edited)
  returnTo?: string;
  onOpenSkill?: () => void;
};

const firstLine = (text: string) => text.split('\n')[0];

/**
 * The skills given to an agent with the total length of their descriptions,
 * and a dialog to add more of the user's skills.
 */

const SkillSelector: React.FC<Props> = ({
  skills,
  isLoading,
  skillIds,
  onChange,
  disabled = false,
  returnTo,
  onOpenSkill,
}) => {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { missingIds, total } = skillsOfAgent(skills, skillIds);
  const byId = useMemo(
    () => new Map(skills.map((s) => [s.skillId, s])),
    [skills]
  );
  const isOverLimit = total > AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH;

  const candidates = useMemo(
    () =>
      searchSkills(skills, searchTerm).filter(
        (s) => !skillIds.includes(s.skillId)
      ),
    [skills, skillIds, searchTerm]
  );

  const remove = (skillId: string) =>
    onChange(skillIds.filter((id) => id !== skillId));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('agent_builder.skills')}</h2>
        <Button
          outlined
          onClick={() => setIsDialogOpen(true)}
          disabled={disabled || isLoading}>
          <AddIcon className="mr-1" />
          {t('agent_builder.add_skill')}
        </Button>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        {t('agent_builder.skills_description')}
      </p>

      {skillIds.length > 0 && (
        <ul className="mb-3 divide-y rounded border">
          {skillIds.map((skillId) => {
            const skill = byId.get(skillId);
            return (
              <li
                key={skillId}
                className="flex items-center gap-2 px-3 py-2"
                data-testid="attached-skill">
                <div className="min-w-0 flex-1">
                  {skill ? (
                    <>
                      {/* Same tab: the agent being edited is kept and comes back */}
                      <Link
                        to={skillPagePath(
                          `/agent-builder/skills/${encodeURIComponent(skill.skillId)}/edit`,
                          returnTo
                        )}
                        onClick={onOpenSkill}
                        title={t('agent_builder.edit_skill')}
                        className="text-aws-smile text-sm font-medium hover:underline">
                        {skill.name}
                      </Link>
                      <div className="truncate text-xs text-gray-500">
                        {firstLine(skill.description)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-red-600">
                      {isLoading
                        ? t('common.loading')
                        : t('agent_builder.skill_deleted')}
                    </div>
                  )}
                </div>
                <ButtonIcon
                  onClick={() => remove(skillId)}
                  disabled={disabled}
                  title={t('agent_builder.remove_skill')}>
                  <RemoveIcon />
                </ButtonIcon>
              </li>
            );
          })}
        </ul>
      )}

      <p
        className={`text-xs ${isOverLimit ? 'font-semibold text-red-600' : 'text-gray-500'}`}
        data-testid="skill-description-total">
        {t('agent_builder.skill_descriptions_total', {
          total: total.toLocaleString(),
          max: AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH.toLocaleString(),
        })}
      </p>
      {isOverLimit && (
        <p className="mt-1 text-xs text-red-600">
          {t('agent_builder.skill_descriptions_over_limit')}
        </p>
      )}
      {!isLoading && missingIds.length > 0 && (
        <p className="mt-1 text-xs text-red-600">
          {t('agent_builder.remove_deleted_skills')}
        </p>
      )}

      <ModalDialog
        isOpen={isDialogOpen}
        title={t('agent_builder.add_skill')}
        onClose={() => setIsDialogOpen(false)}>
        <div className="space-y-3">
          <InputText
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('agent_builder.search_skills')}
          />
          {candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              {skills.length === 0
                ? t('agent_builder.no_skills_yet')
                : t('agent_builder.no_matching_skills')}
            </p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto rounded border">
              {candidates.map((skill) => (
                <li key={skill.skillId}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-100"
                    onClick={() => {
                      onChange([...skillIds, skill.skillId]);
                      setIsDialogOpen(false);
                      setSearchTerm('');
                    }}>
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="line-clamp-2 text-xs text-gray-500">
                      {skill.description}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between">
            <Link
              to={skillPagePath('/agent-builder/skills/create', returnTo)}
              onClick={onOpenSkill}
              className="text-aws-smile text-sm hover:underline">
              {t('agent_builder.create_skill')}
            </Link>
            <Button outlined onClick={() => setIsDialogOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};

export default SkillSelector;
