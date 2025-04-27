import { useState } from 'react';
import useFileApi from './useFileApi';
import { S3FileType } from 'generative-ai-use-cases';

const useRagFile = () => {
  const { getFileDownloadSignedUrl } = useFileApi();
  const [downloading, setDownloading] = useState(false);

  return {
    isS3Url: (url: string) => {
      return /^https:\/\/(|[\w\\-]+\.)s3(|(\.|-)[\w\\-]+).amazonaws.com\//.test(
        url
      )
        ? true
        : false;
    },
    downloadDoc: async (url: string, s3FileType?: S3FileType) => {
      setDownloading(true);

      try {
        const signedUrl = await getFileDownloadSignedUrl(url, s3FileType);
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.error(e);
      } finally {
        setDownloading(false);
      }
    },
    downloading,
  };
};

export default useRagFile;
