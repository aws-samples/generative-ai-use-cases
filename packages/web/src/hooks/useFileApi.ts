import {
  GetFileUploadSignedUrlRequest,
  GetFileUploadSignedUrlResponse,
  UploadFileRequest,
  GetFileDownloadSignedUrlRequest,
  GetFileDownloadSignedUrlResponse,
  DeleteFileResponse,
  S3Type,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';
import axios from 'axios';

const useFileApi = () => {
  const http = useHttp();
  const parseS3Url = (s3Url: string) => {
    let result = /^s3:\/\/(?<bucketName>.+?)\/(?<prefix>.+)/.exec(s3Url);

    if (!result) {
      result =
        /^https:\/\/s3.(?<region>.+?).amazonaws.com\/(?<bucketName>.+?)\/(?<prefix>.+)$/.exec(
          s3Url
        );

      if (!result) {
        result =
          /^https:\/\/(?<bucketName>.+?).s3(|(\.|-)(?<region>.+?)).amazonaws.com\/(?<prefix>.+)$/.exec(
            s3Url
          );
      }
    }

    return result?.groups as {
      bucketName: string;
      prefix: string;
      region?: string;
    };
  };
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
    getFileDownloadSignedUrl: async (s3Url: string, s3Type?: S3Type) => {
      const { bucketName, prefix, region } = parseS3Url(s3Url);

      const [filePrefix, anchorLink] = prefix.split('#');

      // Get the signed URL
      const params: GetFileDownloadSignedUrlRequest = {
        bucketName,
        filePrefix: decodeURIComponent(filePrefix),
        region,
        s3Type,
      };
      const { data: url } =
        await http.api.get<GetFileDownloadSignedUrlResponse>('/file/url', {
          params,
        });
      return `${url}${anchorLink ? `#${anchorLink}` : ''}`;
    },
    deleteUploadedFile: async (fileName: string) => {
      return http.delete<DeleteFileResponse>(`file/${fileName}`);
    },
    getS3Uri: (s3Url: string) => {
      const { bucketName, prefix } = parseS3Url(s3Url);
      return `s3://${bucketName}/${prefix}`;
    },
  };
};

export default useFileApi;
