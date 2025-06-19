import React, { useState } from 'react';
import ButtonIcon from '../ButtonIcon';
import { BaseProps } from '../../@types/common';
import { PiUploadSimple } from 'react-icons/pi';
import useHttp from '../../hooks/useHttp';

type Props = BaseProps & {
  useCaseId: string;
};

const ButtonUseCaseExport: React.FC<Props> = (props) => {
  const [isExporting, setIsExporting] = useState(false);
  const { api } = useHttp();

  const onClickExport = async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const response = await api.get(`/usecases/${props.useCaseId}`);
      const useCaseData = response.data;

      // Create export data with the requested format
      const exportData = {
        promptTemplate: useCaseData.promptTemplate || '',
        fixedModelId: useCaseData.fixedModelId || '',
        fileUpload: !!useCaseData.fileUpload,
        inputExamples: useCaseData.inputExamples || [],
        description: useCaseData.description || '',
        title: useCaseData.title || '',
      };

      // Create a blob with the JSON data in the specified format
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = `${useCaseData.title || 'usecase'}.json`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export use case:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ButtonIcon
      className={props.className ?? ''}
      onClick={onClickExport}
      disabled={isExporting}>
      <PiUploadSimple />
    </ButtonIcon>
  );
};

export default ButtonUseCaseExport;
