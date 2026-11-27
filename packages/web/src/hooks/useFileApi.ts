import {
  GetFileUploadSignedUrlRequest,
  GetFileUploadSignedUrlResponse,
  UploadFileRequest,
  GetFileDownloadSignedUrlRequest,
  GetFileDownloadSignedUrlResponse,
  DeleteFileResponse,
} from 'generative-ai-use-cases';
import {
  USER_FILE_PREFIX,
  parseS3ObjectUrl,
} from '@generative-ai-use-cases/common';
import useHttp from './useHttp';
import axios from 'axios';

/**
 * The shared chat (`shareId`) an S3 URL is shown in. The server signs the
 * files the shared chat attaches through it.
 */
export type FileScope = {
  shareId?: string;
};

const useFileApi = () => {
  const http = useHttp();

  return {
    getSignedUrl: (req: GetFileUploadSignedUrlRequest) => {
      return http.post<GetFileUploadSignedUrlResponse>('file/url', req);
    },
    uploadFile: (url: string, req: UploadFileRequest) => {
      return axios({
        method: 'PUT',
        url: url,
        headers: { 'Content-Type': 'file/*' },
        data: req.file,
      });
    },
    /** Download URL for an S3 URL (a file or a cited document). */
    getFileDownloadSignedUrl: async (s3Url: string, scope?: FileScope) => {
      const [uri, anchor] = s3Url.split('#');
      const params: GetFileDownloadSignedUrlRequest = { uri, ...scope };
      const { data } = await http.api.get<GetFileDownloadSignedUrlResponse>(
        '/file/url',
        { params }
      );
      return `${data}${anchor ? `#${anchor}` : ''}`;
    },
    /** True when the URL is one of the per-user files (`users/...`). */
    isUserFileUrl: (s3Url: string): boolean =>
      !!parseS3ObjectUrl(s3Url)?.key.startsWith(USER_FILE_PREFIX),
    deleteUploadedFile: async (s3Url: string) => {
      const key = parseS3ObjectUrl(s3Url)?.key;
      if (!key) return null;
      return http.api.delete<DeleteFileResponse>('/file', {
        params: { key },
      });
    },
    getS3Uri: (s3Url: string) => {
      const location = parseS3ObjectUrl(s3Url);
      return location ? `s3://${location.bucket}/${location.key}` : s3Url;
    },
  };
};

export default useFileApi;
