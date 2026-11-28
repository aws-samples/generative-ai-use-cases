import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PiPlus as AddIcon } from 'react-icons/pi';
import Button from '../../components/Button';
import Card from '../../components/Card';
import InputText from '../../components/InputText';
import Skeleton from '../../components/Skeleton';
import AgentBuilderSwitch from '../../components/agentBuilder/AgentBuilderSwitch';
import { useSkillList } from '../../hooks/agentBuilder/useAgentSkills';
import { searchSkills } from '../../utils/agentSkills';

const SkillListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { skills, isLoading } = useSkillList();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(
    () => searchSkills(skills, searchTerm),
    [skills, searchTerm]
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row">
        <div className="flex-1" />
        <div className="hidden flex-row items-center justify-center text-xl font-semibold lg:flex print:flex">
          {t('agent_builder.title')}
        </div>
        <div className="flex flex-1 justify-end">
          <Button onClick={() => navigate('/agent-builder/skills/create')}>
            <AddIcon className="mr-2" />
            {t('agent_builder.create_skill')}
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <AgentBuilderSwitch current="skills" />
      </div>

      <p className="text-center text-sm text-gray-600">
        {t('agent_builder.skills_page_description')}
      </p>

      <Card>
        <div className="mb-4">
          <InputText
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('agent_builder.search_skills')}
          />
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex h-full w-full items-center justify-center py-16 text-sm font-bold text-gray-400">
            {skills.length === 0
              ? t('agent_builder.no_skills_yet')
              : t('agent_builder.no_matching_skills')}
          </div>
        )}

        {filtered.map((skill, idx) => (
          <div
            key={skill.skillId}
            className={`cursor-pointer p-3 hover:bg-gray-100 ${idx > 0 ? 'border-t' : ''}`}
            onClick={() =>
              navigate(
                `/agent-builder/skills/${encodeURIComponent(skill.skillId)}/edit`
              )
            }>
            <div className="mb-1 text-sm font-bold">{skill.name}</div>
            <div className="line-clamp-2 text-xs font-light text-gray-600">
              {skill.description}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

export default SkillListPage;
