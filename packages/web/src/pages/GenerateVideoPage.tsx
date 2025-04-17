import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { VideoJob, GenerateVideoParams } from 'generative-ai-use-cases';
import { create } from 'zustand';
import useVideo from '../hooks/useVideo';
import { MODELS } from '../hooks/useModel';
import useFileApi from '../hooks/useFileApi';
import useFiles from '../hooks/useFiles';
import Textarea from '../components/Textarea';
import Select from '../components/Select';
import RangeSlider from '../components/RangeSlider';
import Switch from '../components/Switch';
import ButtonIcon from '../components/ButtonIcon';
import Button from '../components/Button';
import ButtonCopy from '../components/ButtonCopy';
import Card from '../components/Card';
import ZoomUpImage from '../components/ZoomUpImage';
import {
  PiPlayFill,
  PiDownload,
  PiSpinnerGap,
  PiArrowClockwise,
  PiTrash,
  PiUpload,
} from 'react-icons/pi';
import { GenerateVideoPageQueryParams } from '../@types/navigate';
import { useLocation } from 'react-router-dom';
import queryString from 'query-string';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const TASK_TYPES = (modelId: string): string[] => {
  if (modelId === 'amazon.nova-reel-v1:1') {
    return ['TEXT_VIDEO', 'MULTI_SHOT_AUTOMATED'];
  }

  return [];
};

const MODEL_PARAMS = (
  modelId: string,
  taskType: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> => {
  if (modelId === 'amazon.nova-reel-v1:0') {
    return {
      dimension: ['1280x720'],
      durationSeconds: [6],
      fps: [24],
      seed: 0,
      images: {
        accept: {
          image: ['.jpg', '.jpeg', '.png'],
        },
        maxImageFileCount: 1,
        maxImageFileSizeMB: 10,
        strictImageDimensions: [{ width: 1280, height: 720 }],
      },
    };
  } else if (modelId === 'amazon.nova-reel-v1:1') {
    if (taskType === 'TEXT_VIDEO') {
      return {
        dimension: ['1280x720'],
        durationSeconds: [6],
        fps: [24],
        seed: 0,
        images: {
          accept: {
            image: ['.jpg', '.jpeg', '.png'],
          },
          maxImageFileCount: 1,
          maxImageFileSizeMB: 10,
          strictImageDimensions: [{ width: 1280, height: 720 }],
        },
      };
    } else if (taskType === 'MULTI_SHOT_AUTOMATED') {
      return {
        dimension: ['1280x720'],
        durationSeconds: [
          12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108,
          114, 120,
        ],
        fps: [24],
        seed: 0,
      };
    }
  } else if (modelId === 'luma.ray-v2:0') {
    return {
      resolution: ['540p', '720p'],
      durationSeconds: [5, 9],
      aspectRatio: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      loop: false,
    };
  }

  return {};
};

type StateType = Omit<Required<GenerateVideoParams>, 'images'> & {
  videoGenModelId: string;
  setVideoGenModelId: (s: string) => void;
  setTaskType: (s: string) => void;
  setPrompt: (s: string) => void;
  setDimension: (s: string) => void;
  setDurationSeconds: (n: number) => void;
  setFps: (n: number) => void;
  setSeed: (n: number) => void;
  setResolution: (s: string) => void;
  setAspectRatio: (s: string) => void;
  setLoop: (b: boolean) => void;
  clear: () => void;
};

const useGenerateVideoPageState = create<StateType>((set) => {
  const INIT_STATE = {
    videoGenModelId: '',
    taskType: '',
    prompt: '',
    dimension: '',
    durationSeconds: 0,
    fps: 0,
    seed: 0,
    resolution: '',
    aspectRatio: '',
    loop: false,
  };
  return {
    ...INIT_STATE,
    setVideoGenModelId: (s: string) => {
      set(() => ({
        videoGenModelId: s,
      }));
    },
    setTaskType: (s: string) => {
      set(() => ({
        taskType: s,
      }));
    },
    setPrompt: (s: string) => {
      set(() => ({
        prompt: s,
      }));
    },
    setDimension: (s: string) => {
      set(() => ({
        dimension: s,
      }));
    },
    setDurationSeconds: (n: number) => {
      set(() => ({
        durationSeconds: n,
      }));
    },
    setFps: (n: number) => {
      set(() => ({
        fps: n,
      }));
    },
    setSeed: (n: number) => {
      set(() => ({
        seed: n,
      }));
    },
    setResolution: (s: string) => {
      set(() => ({
        resolution: s,
      }));
    },
    setAspectRatio: (s: string) => {
      set(() => ({
        aspectRatio: s,
      }));
    },
    setLoop: (b: boolean) => {
      set(() => ({
        loop: b,
      }));
    },
    clear: () => {
      set(INIT_STATE);
    },
  };
});

const GenerateVideoPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    videoGenModelId,
    setVideoGenModelId,
    taskType,
    setTaskType,
    prompt,
    setPrompt,
    dimension,
    setDimension,
    durationSeconds,
    setDurationSeconds,
    fps,
    setFps,
    seed,
    setSeed,
    resolution,
    setResolution,
    aspectRatio,
    setAspectRatio,
    loop,
    setLoop,
    clear,
  } = useGenerateVideoPageState();
  const { pathname, search } = useLocation();
  const {
    generate,
    videoJobs,
    mutateVideoJobs,
    canLoadMoreVideoJobs,
    loadMoreVideoJobs,
    isLoadingVideoJobs,
    isValidatingVideoJobs,
    deleteVideoJob: deleteVideoJobInner,
  } = useVideo();
  const {
    uploadFiles,
    uploadedFiles,
    deleteUploadedFile,
    errorMessages,
    clear: clearFiles,
  } = useFiles(pathname);
  const { videoGenModelIds, videoGenModels } = MODELS;
  const { getFileDownloadSignedUrl } = useFileApi();
  const [previewVideoSrc, setPreviewVideoSrc] = useState('');
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingJobIds, setDownloadingJobIds] = useState<
    Record<string, boolean>
  >({});
  const [deletingJobIds, setDeletingJobIds] = useState<Record<string, boolean>>(
    {}
  );

  const onChangeFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      const fileLimit = MODEL_PARAMS(videoGenModelId, taskType).images;
      const accept = MODEL_PARAMS(
        videoGenModelId,
        taskType
      ).images?.accept?.image?.join(',');

      if (files) {
        // Reflect the files and upload
        uploadFiles(Array.from(files), fileLimit, accept);
      }
    },
    [videoGenModelId, uploadFiles, taskType]
  );

  useEffect(() => {
    const _modelId =
      videoGenModelId === '' ? videoGenModelIds[0] : videoGenModelId;

    if (search !== '') {
      const params = queryString.parse(search) as GenerateVideoPageQueryParams;
      setPrompt(params.prompt ?? '');
      setVideoGenModelId(
        videoGenModelIds.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setVideoGenModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoGenModelId, videoGenModelIds, search, setPrompt]);

  useEffect(() => {
    if (videoGenModelId === '') {
      setVideoGenModelId(videoGenModelIds[0]);
    } else {
      if (!TASK_TYPES(videoGenModelId).includes(taskType)) {
        setTaskType(TASK_TYPES(videoGenModelId)[0] ?? '');
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).dimension) {
        setDimension(MODEL_PARAMS(videoGenModelId, taskType).dimension[0]);
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).durationSeconds) {
        setDurationSeconds(
          MODEL_PARAMS(videoGenModelId, taskType).durationSeconds[0]
        );
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).fps) {
        setFps(MODEL_PARAMS(videoGenModelId, taskType).fps[0]!);
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).seed !== undefined) {
        setSeed(MODEL_PARAMS(videoGenModelId, taskType).seed);
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).resolution) {
        setResolution(MODEL_PARAMS(videoGenModelId, taskType).resolution[0]!);
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).aspectRatio) {
        setAspectRatio(MODEL_PARAMS(videoGenModelId, taskType).aspectRatio[0]!);
      }

      if (MODEL_PARAMS(videoGenModelId, taskType).loop !== undefined) {
        setLoop(MODEL_PARAMS(videoGenModelId, taskType).loop);
      }
    }
  }, [
    videoGenModelId,
    taskType,
    setVideoGenModelId,
    setTaskType,
    setDimension,
    setDurationSeconds,
    setFps,
    setSeed,
    setResolution,
    setAspectRatio,
    setLoop,
    videoGenModelIds,
  ]);

  const generateVideo = useCallback(async () => {
    setIsGenerating(true);

    try {
      const params: GenerateVideoParams = {
        taskType,
        prompt,
        durationSeconds,
        dimension,
        fps,
        seed,
        resolution,
        aspectRatio,
        loop,
        images:
          MODEL_PARAMS(videoGenModelId, taskType).images &&
          uploadedFiles.length > 0
            ? uploadedFiles.map((f) => {
                return {
                  format: f.base64EncodedData!.includes('data:image/png')
                    ? 'png'
                    : 'jpeg',
                  source: {
                    bytes: f.base64EncodedData!.split(';base64,')[1],
                  },
                };
              })
            : undefined,
      };

      await generate(
        params,
        videoGenModels.find((m) => m.modelId === videoGenModelId)
      );

      mutateVideoJobs();

      toast.info(t('video.generation.started'));
    } catch (e) {
      console.error(e);
      toast.error(t('video.generation.failed', { error: e }), {
        duration: 30000,
        closeButton: true,
      });
    }

    setIsGenerating(false);
  }, [
    taskType,
    generate,
    prompt,
    durationSeconds,
    fps,
    dimension,
    seed,
    resolution,
    aspectRatio,
    loop,
    videoGenModels,
    videoGenModelId,
    mutateVideoJobs,
    setIsGenerating,
    t,
    uploadedFiles,
  ]);

  const setPreview = useCallback(
    async (job: VideoJob) => {
      setPreviewPrompt(job.prompt);
      const signedUrl = await getFileDownloadSignedUrl(job.output);
      setPreviewVideoSrc(signedUrl);
    },
    [setPreviewPrompt, getFileDownloadSignedUrl, setPreviewVideoSrc]
  );

  const downloadFile = useCallback(
    async (job: VideoJob) => {
      setDownloadingJobIds({ ...downloadingJobIds, [job.createdDate]: true });
      const signedUrl = await getFileDownloadSignedUrl(job.output);
      const res = await fetch(signedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `video_${job.jobId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadingJobIds({ ...downloadingJobIds, [job.createdDate]: false });
    },
    [setDownloadingJobIds, downloadingJobIds, getFileDownloadSignedUrl]
  );

  const deleteVideoJob = useCallback(
    async (job: VideoJob) => {
      setDeletingJobIds({ ...deletingJobIds, [job.createdDate]: true });
      await deleteVideoJobInner(job);
      mutateVideoJobs();
      setDeletingJobIds({ ...deletingJobIds, [job.createdDate]: false });
    },
    [deleteVideoJobInner, mutateVideoJobs, deletingJobIds, setDeletingJobIds]
  );

  const disabledExec = useMemo(() => {
    return prompt.length === 0 || isGenerating || errorMessages.length > 0;
  }, [prompt, isGenerating, errorMessages]);

  const clearable = useMemo(() => {
    return (prompt.length > 0 || uploadedFiles.length > 0) && !isGenerating;
  }, [prompt, isGenerating, uploadedFiles]);

  const formatDate = useCallback((createdDate: string) => {
    const date = new Date(Number(createdDate));
    return date.toLocaleString();
  }, []);

  return (
    <div className="grid h-screen grid-cols-12 gap-4 p-4">
      <div className="col-span-12 lg:col-span-4">
        <Card>
          <Select
            label={t('video.model')}
            value={videoGenModelId}
            onChange={setVideoGenModelId}
            options={videoGenModelIds.map((m) => {
              return { value: m, label: m };
            })}
            fullWidth
          />

          {TASK_TYPES(videoGenModelId).length > 0 && (
            <Select
              label={t('video.taskType')}
              value={taskType}
              onChange={setTaskType}
              options={TASK_TYPES(videoGenModelId).map((m: string) => {
                return { value: m, label: m };
              })}
              fullWidth
            />
          )}

          {MODEL_PARAMS(videoGenModelId, taskType) && (
            <>
              <Textarea
                value={prompt}
                onChange={setPrompt}
                label={t('video.prompt.title')}
                placeholder={t('video.prompt.placeholder')}
                rows={3}
                required
              />

              {MODEL_PARAMS(videoGenModelId, taskType).dimension && (
                <Select
                  label={t('video.dimension')}
                  value={dimension}
                  onChange={setDimension}
                  options={MODEL_PARAMS(
                    videoGenModelId,
                    taskType
                  ).dimension.map((m: string) => {
                    return { value: m, label: m };
                  })}
                  fullWidth
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).resolution && (
                <Select
                  label={t('video.resolution')}
                  value={resolution}
                  onChange={setResolution}
                  options={MODEL_PARAMS(
                    videoGenModelId,
                    taskType
                  ).resolution.map((m: string) => {
                    return { value: m, label: m };
                  })}
                  fullWidth
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).aspectRatio && (
                <Select
                  label={t('video.aspectRatio')}
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  options={MODEL_PARAMS(
                    videoGenModelId,
                    taskType
                  ).aspectRatio.map((m: string) => {
                    return { value: m, label: m };
                  })}
                  fullWidth
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).durationSeconds && (
                <Select
                  label={t('video.duration')}
                  value={`${durationSeconds}`}
                  onChange={(n: string) => {
                    setDurationSeconds(Number(n));
                  }}
                  options={MODEL_PARAMS(
                    videoGenModelId,
                    taskType
                  ).durationSeconds.map((m: number) => {
                    return { value: `${m}`, label: `${m}` };
                  })}
                  fullWidth
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).fps && (
                <Select
                  label={t('video.fps')}
                  value={`${fps}`}
                  onChange={(n: string) => {
                    setFps(Number(n));
                  }}
                  options={MODEL_PARAMS(videoGenModelId, taskType).fps.map(
                    (m: number) => {
                      return { value: `${m}`, label: `${m}` };
                    }
                  )}
                  fullWidth
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).seed !== undefined && (
                <RangeSlider
                  className="w-full"
                  label={t('video.seed.title')}
                  min={0}
                  max={2147483646}
                  value={seed}
                  onChange={(n) => {
                    setSeed(n);
                  }}
                  help={t('video.seed.help')}
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).loop !== undefined && (
                <Switch
                  className="w-full"
                  label={t('video.loop')}
                  checked={loop}
                  onSwitch={(l) => {
                    setLoop(l);
                  }}
                />
              )}

              {MODEL_PARAMS(videoGenModelId, taskType).images && (
                <div>
                  <div className="text-sm">{t('video.uploadImage')}</div>

                  {/* Currently, <input multiple/> is not necessary, but multiple is set for future extensibility */}
                  <label>
                    <input
                      hidden
                      onChange={onChangeFiles}
                      type="file"
                      accept={MODEL_PARAMS(
                        videoGenModelId,
                        taskType
                      ).images!.accept.image.join(',')}
                      multiple
                      value={[]}
                    />
                    <div className="text-aws-smile border-aws-smile my-2 flex w-full cursor-pointer flex-row items-center justify-center rounded-full border-2 bg-white p-1 text-sm hover:bg-gray-100">
                      <PiUpload className="mr-1 text-base" />{' '}
                      {t('video.upload')}
                    </div>
                  </label>

                  <p className="my-1 text-xs">{t('video.uploadImageHelp')}</p>

                  <p className="my-1 text-xs text-gray-400">
                    {t('video.supportedExtensions', {
                      acceptedExtensions: MODEL_PARAMS(
                        videoGenModelId,
                        taskType
                      ).images!.accept.image.join(', '),
                    })}
                  </p>

                  {MODEL_PARAMS(videoGenModelId, taskType).images!
                    .strictImageDimensions && (
                    <p className="my-1 text-xs text-gray-400">
                      {t('video.supportedImageDimensions', {
                        supportedDimensions: MODEL_PARAMS(
                          videoGenModelId,
                          taskType
                        )
                          .images!.strictImageDimensions.map(
                            (d: { width: number; height: number }) =>
                              `${d.width}x${d.height}`
                          )
                          .join(', '),
                      })}
                    </p>
                  )}

                  {errorMessages.length > 0 && (
                    <div>
                      {errorMessages.map((errorMessage, idx) => (
                        <p key={idx} className="text-red-500">
                          {errorMessage}
                        </p>
                      ))}
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((uploadedFile, idx) => {
                        return (
                          <ZoomUpImage
                            key={idx}
                            src={uploadedFile.base64EncodedData}
                            loading={uploadedFile.uploading}
                            deleting={uploadedFile.deleting}
                            size="s"
                            error={uploadedFile.errorMessages.length > 0}
                            onDelete={() => {
                              deleteUploadedFile(
                                uploadedFile.id ?? '',
                                MODEL_PARAMS(videoGenModelId, taskType).images!,
                                MODEL_PARAMS(videoGenModelId, taskType).images!
                                  .accept.image
                              );
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex flex-row items-center gap-x-5">
            <Button
              className="h-8 w-full"
              disabled={disabledExec}
              onClick={generateVideo}
              loading={isGenerating}>
              {t('video.generate')}
            </Button>
            <Button
              className="h-8 w-full"
              outlined
              onClick={() => {
                clear();
                clearFiles();
              }}
              disabled={!clearable}>
              {t('video.clear')}
            </Button>
          </div>
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-8">
        <Card className="lg:min-h-[calc(100vh-2rem)]">
          <div className="flex flex-col items-center justify-center gap-y-4">
            {previewVideoSrc.length > 0 ? (
              <video
                className="w-128 h-72 max-w-full"
                src={previewVideoSrc}
                autoPlay
                loop
                controls
              />
            ) : (
              <div className="w-128 relative h-72 max-w-full border">
                <div className="absolute inset-0 flex items-center justify-center">
                  <PiPlayFill className="h-32 w-32 text-gray-200" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  {t('video.press.play')}
                </div>
              </div>
            )}

            <div className="w-128 relative h-24 max-w-full border p-2">
              {previewPrompt.length > 0 ? (
                <div className="h-full w-full overflow-y-scroll">
                  <ButtonCopy
                    className="absolute bottom-1 right-1"
                    text={previewPrompt}
                  />
                  {previewPrompt}
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {t('video.prompt.display')}
                </div>
              )}
            </div>
          </div>

          <div className="mb-1 mt-4 flex flex-row items-center gap-x-1 text-sm">
            {t('video.job.list')}
            <ButtonIcon
              loading={isValidatingVideoJobs}
              onClick={mutateVideoJobs}
              className="h-8 w-8">
              <PiArrowClockwise className="text-base" />
            </ButtonIcon>
          </div>

          <div className="w-full overflow-x-auto border sm:rounded-lg">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full min-w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-gray-50 text-xs">
                  <tr>
                    <th
                      scope="col"
                      className="min-w-12 bg-gray-50 px-6 py-3"
                      align="center">
                      {t('video.table.play')}
                    </th>
                    <th
                      scope="col"
                      className="min-w-32 bg-gray-50 px-6 py-3"
                      align="left">
                      {t('video.table.status')}
                    </th>
                    <th
                      scope="col"
                      className="min-w-48 bg-gray-50 px-6 py-3"
                      align="center">
                      {t('video.table.prompt')}
                    </th>
                    <th
                      scope="col"
                      className="min-w-48 bg-gray-50 px-6 py-3"
                      align="center">
                      {t('video.table.model')}
                    </th>
                    <th
                      scope="col"
                      className="min-w-48 bg-gray-50 px-6 py-3"
                      align="center">
                      {t('video.table.date')}
                    </th>
                    <th
                      scope="col"
                      className="min-w-32 bg-gray-50 px-6 py-3"
                      align="center">
                      {t('video.table.download')}
                    </th>
                    <th
                      scope="col"
                      className="min-w-12 bg-gray-50 px-6 py-3"
                      align="center">
                      {t('video.table.delete')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {videoJobs.map((job, idx) => {
                    return (
                      <tr
                        key={idx}
                        className="border-b bg-white hover:bg-gray-50">
                        <td
                          className="whitespace-nowrap px-6 py-4"
                          align="center">
                          <ButtonIcon
                            onClick={() => {
                              setPreview(job);
                            }}
                            disabled={job.status !== 'Completed'}>
                            <PiPlayFill className="text-aws-smile" />
                          </ButtonIcon>
                        </td>
                        <td
                          className="whitespace-nowrap px-6 py-4"
                          align="center">
                          {t(`video.status.${job.status.toLowerCase()}`)}
                        </td>
                        <td
                          className="max-w-64 whitespace-nowrap px-6 py-4"
                          align="left">
                          <div className="line-clamp-1">{job.prompt}</div>
                        </td>
                        <td
                          className="whitespace-nowrap px-6 py-4"
                          align="center">
                          {job.modelId}
                        </td>
                        <td
                          className="whitespace-nowrap px-6 py-4"
                          align="center">
                          {formatDate(job.createdDate)}
                        </td>
                        <td
                          className="whitespace-nowrap px-6 py-4"
                          align="center">
                          <ButtonIcon
                            onClick={() => {
                              downloadFile(job);
                            }}
                            disabled={job.status !== 'Completed'}
                            loading={downloadingJobIds[job.createdDate]}>
                            <PiDownload className="text-aws-smile" />
                          </ButtonIcon>
                        </td>
                        <td
                          className="whitespace-nowrap px-6 py-4"
                          align="center">
                          <ButtonIcon
                            onClick={() => {
                              deleteVideoJob(job);
                            }}
                            disabled={job.status === 'InProgress'}
                            loading={deletingJobIds[job.createdDate]}>
                            <PiTrash className="text-red-500" />
                          </ButtonIcon>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {isLoadingVideoJobs && (
                <div className="flex h-12 w-full items-center justify-center">
                  <PiSpinnerGap className="mr-2 animate-spin text-lg" />
                </div>
              )}

              {canLoadMoreVideoJobs && !isLoadingVideoJobs && (
                <div className="flex h-12 w-full items-center justify-center">
                  <div
                    className="cursor-pointer hover:underline"
                    onClick={loadMoreVideoJobs}>
                    {t('video.load.more')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GenerateVideoPage;
