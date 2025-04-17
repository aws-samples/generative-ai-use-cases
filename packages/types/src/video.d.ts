import { PrimaryKey } from './base';

export type GenerateVideoParams = {
  taskType?: string;
  prompt: string;
  durationSeconds: number;
  dimension?: string;
  fps?: number;
  seed?: number;
  resolution?: string;
  aspectRatio?: string;
  loop?: boolean;
  images?: {
    format: 'png' | 'jpeg';
    source: {
      bytes: string;
    };
  }[];
};

export type VideoJob = PrimaryKey & {
  jobId: string;
  invocationArn: string;
  // https://docs.aws.amazon.com/ja_jp/nova/latest/userguide/video-gen-access.html#video-gen-check-progress
  status: 'InProgress' | 'Completed' | 'Failed' | 'Finalizing';
  output: string;
  modelId: string;
  region: string;
  prompt: string;
  params: string;
};
