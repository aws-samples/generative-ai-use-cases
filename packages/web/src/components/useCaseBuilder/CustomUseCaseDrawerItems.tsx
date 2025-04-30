import { UseCaseAsOutput } from 'generative-ai-use-cases';
import React, { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useDrawer from '../../hooks/useDrawer';

type Props = {
  useCases: UseCaseAsOutput[];
};

const CustomUseCaseDrawerItems: React.FC<Props> = (props) => {
  const { useCaseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { switchOpen } = useDrawer();

  const onClick = useCallback(
    (useCaseId: string) => {
      navigate(`/use-case-builder/execute/${useCaseId}`);
      switchOpen();
    },
    [navigate, switchOpen]
  );

  return (
    <div className="flex flex-col gap-y-0.5">
      {props.useCases.map((usecase) => {
        return (
          <div
            key={usecase.useCaseId}
            className={`${location.pathname.startsWith('/use-case-builder/execute/') && useCaseId === usecase.useCaseId ? 'bg-aws-sky' : ''} hover:bg-aws-sky flex h-8 cursor-pointer items-center rounded p-2`}
            onClick={() => {
              onClick(usecase.useCaseId);
            }}>
            <span className="line-clamp-1">{usecase.title}</span>
          </div>
        );
      })}
    </div>
  );
};

export default CustomUseCaseDrawerItems;
