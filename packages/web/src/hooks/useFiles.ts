import { create } from 'zustand';
import useFileApi from './useFileApi';
import { FileLimit, UploadedFileType } from 'generative-ai-use-cases';
import { produce } from 'immer';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import i18next from 'i18next';
import {
  getFileTypeFromMimeType,
  getMimeTypeFromFileHeader,
  validateMimeTypeAndExtension,
} from '../utils/MediaUtils';

export const extractBaseURL = (url: string) => {
  return url.split(/[?#]/)[0];
};

const useFilesState = create<{
  uploadFiles: (
    id: string,
    files: File[],
    fileLimit: FileLimit,
    accept: string[]
  ) => Promise<void>;
  checkFiles: (
    id: string,
    fileLimit: FileLimit,
    accept: string[]
  ) => Promise<void>;
  uploadedFilesDict: Record<string, UploadedFileType[]>;
  errorMessagesDict: Record<string, string[]>;
  deleteUploadedFile: (
    id: string,
    fileId: string,
    fileLimit: FileLimit,
    accept: string[]
  ) => Promise<boolean>;
  clear: (id: string) => void;
  base64Cache: Record<string, string>;
  getFileDownloadSignedUrl: (
    s3Url: string,
    cacheBase64?: boolean
  ) => Promise<string>;
}>((set, get) => {
  const api = useFileApi();

  const clear = (id: string) => {
    set((state) => ({
      uploadedFilesDict: produce(state.uploadedFilesDict, (draft) => {
        draft[id] = [];
      }),
      errorMessagesDict: produce(state.errorMessagesDict, (draft) => {
        draft[id] = [];
      }),
    }));
  };

  // Convert JS File Object to UploadedFileType to handle file upload status
  const convertFile2UploadedFileType = async (file: File) => {
    const mimeType = await getMimeTypeFromFileHeader(file);
    const fileType = getFileTypeFromMimeType(mimeType);
    const fileId = uuidv4();
    return {
      id: fileId,
      file,
      name: file.name,
      type: fileType,
      mimeType,
      uploading: true,
      errorMessages: [],
    } as UploadedFileType;
  };

  const getImageDimensions = (
    file: File
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height,
          });
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  };

  // Validated given uploadedFiles, return updated uploadedFiles (no side effect) and errorMessages
  const validateUploadedFiles = async (
    uploadedFiles: UploadedFileType[],
    fileLimit: FileLimit,
    accept: string[]
  ) => {
    let fileCount = 0;
    let imageFileCount = 0;
    let videoFileCount = 0;

    // Validate uploaded files
    const updatedFiles: UploadedFileType[] = await Promise.all(
      uploadedFiles.map(async (uploadedFile) => {
        const errorMessages: string[] = [];
        const extension = uploadedFile.file.name.split('.').pop() as string;

        // Validate file extension and MIME type
        const isFileExtensionAccepted = accept.includes(`.${extension}`);
        const isMimeTypeValid =
          uploadedFile.mimeType &&
          validateMimeTypeAndExtension(uploadedFile.mimeType, extension);
        if (accept && accept.length === 0) {
          errorMessages.push(i18next.t('files.error.modelNotSupported'));
        } else if (!isFileExtensionAccepted) {
          errorMessages.push(
            i18next.t('files.error.invalidExtension', {
              fileName: uploadedFile.file.name,
              acceptedExtensions: accept.join(', '),
            })
          );
        } else if (!isMimeTypeValid) {
          errorMessages.push(
            i18next.t('files.error.mimeMismatch', {
              fileName: uploadedFile.file.name,
            })
          );
        }

        // Filter by file size
        const getMaxFileSizeMB = (fileType: string) => {
          if (fileType.includes('image')) return fileLimit.maxImageFileSizeMB;
          if (fileType.includes('video')) return fileLimit.maxVideoFileSizeMB;
          return fileLimit.maxFileSizeMB;
        };
        const maxSizeMB = getMaxFileSizeMB(uploadedFile.file.type) || 0;
        const isFileSizeAllowed = uploadedFile.file.size <= maxSizeMB * 1e6;
        if (!isFileSizeAllowed) {
          errorMessages.push(
            i18next.t('files.error.fileSizeExceeded', {
              fileName: uploadedFile.file.name,
              maxSize: maxSizeMB,
            })
          );
        }

        // Filter by file count
        let isFileNumberAllowed = false;
        if (uploadedFile.type === 'image') {
          imageFileCount += 1;
          isFileNumberAllowed =
            imageFileCount <= (fileLimit.maxImageFileCount || 0);
          if (!isFileNumberAllowed) {
            errorMessages.push(
              i18next.t('files.error.imageCountExceeded', {
                maxCount: fileLimit.maxImageFileCount,
              })
            );
          }
          if (fileLimit.strictImageDimensions) {
            const dimension = await getImageDimensions(uploadedFile.file);
            const isAcceptableDimension = fileLimit.strictImageDimensions.some(
              (d) => {
                return (
                  d.width === dimension.width && d.height === dimension.height
                );
              }
            );

            if (!isAcceptableDimension) {
              const humanReadableDimensions = fileLimit.strictImageDimensions
                .map((d) => `${d.width}x${d.height}`)
                .join(', ');
              errorMessages.push(
                i18next.t('files.error.invalidImageDimension', {
                  allowedDimensions: humanReadableDimensions,
                  uploadedDimension: `${dimension.width}x${dimension.height}`,
                })
              );
            }
          }
        } else if (uploadedFile.type === 'video') {
          videoFileCount += 1;
          isFileNumberAllowed =
            videoFileCount <= (fileLimit.maxVideoFileCount || 0);
          if (!isFileNumberAllowed) {
            errorMessages.push(
              i18next.t('files.error.videoCountExceeded', {
                maxCount: fileLimit.maxVideoFileCount,
              })
            );
          }
        } else {
          fileCount += 1;
          isFileNumberAllowed = fileCount <= (fileLimit.maxFileCount || 0);
          if (!isFileNumberAllowed) {
            errorMessages.push(
              i18next.t('files.error.fileCountExceeded', {
                maxCount: fileLimit.maxFileCount,
              })
            );
          }
        }

        return {
          ...uploadedFile,
          errorMessages: errorMessages,
        } as UploadedFileType;
      })
    );

    return {
      uploadedFiles: updatedFiles,
      errorMessages: [
        ...new Set(
          updatedFiles.flatMap((uploadedFile) => uploadedFile.errorMessages)
        ),
      ],
    };
  };

  // Refresh error messages
  const checkFiles = async (
    id: string,
    fileLimit: FileLimit,
    accept: string[]
  ) => {
    // Get current files
    const currentUploadedFiles = get().uploadedFilesDict[id] ?? [];

    // Get updated error messages
    const { uploadedFiles: newUploadedFiles, errorMessages } =
      await validateUploadedFiles(currentUploadedFiles, fileLimit, accept);

    set(
      produce((state) => {
        state.uploadedFilesDict[id] = newUploadedFiles;
        state.errorMessagesDict[id] = errorMessages;
      })
    );
  };

  // Handle File Uploads
  const uploadFiles = async (
    id: string,
    files: File[],
    fileLimit: FileLimit,
    accept: string[]
  ) => {
    // Get File
    const currentUploadedFiles = get().uploadedFilesDict[id] ?? [];
    const uploadedFiles = await Promise.all(
      files.map((f) => convertFile2UploadedFileType(f))
    );
    const newUploadedFiles: UploadedFileType[] = [
      ...currentUploadedFiles,
      ...uploadedFiles,
    ];

    // Validate File
    const { uploadedFiles: validatedFiles, errorMessages } =
      await validateUploadedFiles(newUploadedFiles, fileLimit, accept);

    // Update zustand to reflect current status to UI

    set(
      produce((state) => {
        state.uploadedFilesDict[id] = validatedFiles;
        state.errorMessagesDict[id] = errorMessages;
      })
    );
    // Upload File
    get().uploadedFilesDict[id].forEach((uploadedFile, idx) => {
      if (!uploadedFile.uploading) return;

      // "Upload image => Get signed URL => Download image" takes time to display the image on the screen, so select the image and display it immediately (UX improvement)
      const reader = new FileReader();
      reader.readAsDataURL(uploadedFile.file);
      reader.onload = () => {
        set(
          produce((state) => {
            state.uploadedFilesDict[id][idx].base64EncodedData =
              reader.result?.toString();
          })
        );
      };

      const mediaFormat = uploadedFile.file.name.split('.').pop() as string;

      // Get signed URL (execute in parallel without await to improve UX)
      api
        .getSignedUrl({
          filename: uploadedFile.file.name,
          mediaFormat: mediaFormat,
        })
        .then(async (signedUrlRes) => {
          const signedUrl = signedUrlRes.data;
          const fileUrl = extractBaseURL(signedUrl); // Remove query parameters from signed URL
          // Upload file
          api.uploadFile(signedUrl, { file: uploadedFile.file }).then(() => {
            const currentIdx = get().uploadedFilesDict[id].findIndex(
              (file) => file.id === uploadedFile.id
            ); // If the previous file is deleted during upload, the idx changes
            set(
              produce((state) => {
                state.uploadedFilesDict[id][currentIdx].uploading = false;
                state.uploadedFilesDict[id][currentIdx].s3Url = fileUrl;
                state.base64Cache = {
                  ...state.base64Cache,
                  [fileUrl]: reader.result?.toString() ?? '',
                };
              })
            );
          });
        });
    });
  };

  // Delete Uploaded File
  const deleteUploadedFile = async (
    id: string,
    fileId: string,
    fileLimit: FileLimit,
    accept: string[]
  ) => {
    const findTargetIndex = () =>
      get().uploadedFilesDict[id].findIndex((file) => file.id === fileId);

    let targetIndex = findTargetIndex();
    if (targetIndex > -1) {
      // "https://BUCKET_NAME.s3.REGION.amazonaws.com/FILENAME" format is set
      const result = /https:\/\/.+\/(?<fileName>.+)/.exec(
        get().uploadedFilesDict[id][targetIndex].s3Url ?? ''
      );
      const fileName = result?.groups?.fileName;

      if (fileName) {
        // Set deleting state
        set(
          produce((state) => {
            state.uploadedFilesDict[id][targetIndex].deleting = true;
          })
        );

        await api.deleteUploadedFile(fileName);

        // If other images are deleted during deletion processing, the index shifts, so get it again
        targetIndex = findTargetIndex();
        set(
          produce((state) => {
            state.uploadedFilesDict[id].splice(targetIndex, 1);
          })
        );

        // Refresh error messages
        await checkFiles(id, fileLimit, accept);

        return true;
      }
    }
    return false;
  };

  // Move getFileDownloadSignedUrl to useFileApi and add Base64 cache functionality
  const getFileDownloadSignedUrl = async (
    s3Url: string,
    cacheBase64?: boolean
  ) => {
    const url = await api.getFileDownloadSignedUrl(s3Url);

    // If Base64 cache is requested
    if (cacheBase64) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();

        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Update cache
        set((state) => ({
          base64Cache: {
            ...state.base64Cache,
            [s3Url]: base64Data,
          },
        }));
      } catch (error) {
        console.error('Failed to cache base64 data:', error);
      }
    }

    return url;
  };

  return {
    clear,
    uploadedFilesDict: {},
    errorMessagesDict: {},
    uploadFiles,
    checkFiles,
    deleteUploadedFile,
    base64Cache: {},
    getFileDownloadSignedUrl,
  };
});

const useFiles = (id: string) => {
  const {
    uploadFiles,
    checkFiles,
    clear,
    uploadedFilesDict,
    deleteUploadedFile,
    errorMessagesDict,
    base64Cache,
    getFileDownloadSignedUrl,
  } = useFilesState();

  return {
    uploadFiles: (files: File[], fileLimit: FileLimit, accept: string[]) =>
      uploadFiles(id, files, fileLimit, accept),
    checkFiles: useCallback(
      (fileLimit: FileLimit, accept: string[]) =>
        checkFiles(id, fileLimit, accept),
      [checkFiles, id]
    ),
    errorMessages: errorMessagesDict[id] ?? [],
    clear: () => clear(id),
    uploadedFiles: uploadedFilesDict[id] ?? [],
    deleteUploadedFile: (
      fileId: string,
      fileLimit: FileLimit,
      accept: string[]
    ) => deleteUploadedFile(id, fileId, fileLimit, accept),
    uploading:
      uploadedFilesDict[id]?.some((uploadedFile) => uploadedFile.uploading) ??
      false,
    base64Cache,
    getFileDownloadSignedUrl,
  };
};

export default useFiles;
