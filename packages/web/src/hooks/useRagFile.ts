import { useState } from 'react';
import useFileApi, { FileScope } from './useFileApi';

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
    downloadDoc: async (url: string, scope?: FileScope) => {
      setDownloading(true);

      try {
        const signedUrl = await getFileDownloadSignedUrl(url, scope);
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
