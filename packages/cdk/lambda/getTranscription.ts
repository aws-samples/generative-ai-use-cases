import { Request, Response } from 'express';
import { requireUserSub, sendJson } from './utils/http';
import {
  TranscribeClient,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetTranscriptionResponse, Transcript } from 'generative-ai-use-cases';

function parseS3Url(s3Url: string) {
  const url = new URL(s3Url);

  const pathParts = url.pathname.split('/');
  const bucket = pathParts[1];
  const key = pathParts.slice(2).join('/');

  return { bucket, key };
}

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const transcribeClient = new TranscribeClient({});
  const s3Client = new S3Client({});
  const jobName = request.params.jobName;
  const userId = requireUserSub(request);

  const command = new GetTranscriptionJobCommand({
    TranscriptionJobName: jobName,
  });
  const res = await transcribeClient.send(command);

  if (
    // Return Forbidden error if the user who started the job is different
    res.TranscriptionJob?.Tags!.find(
      (tag) => tag.Key === 'userId' && tag.Value !== userId
    )
  ) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  if (res.TranscriptionJob?.TranscriptionJobStatus === 'COMPLETED') {
    const { bucket, key } = parseS3Url(
      res.TranscriptionJob.Transcript!.TranscriptFileUri!
    );
    const s3Result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    const output = JSON.parse(await s3Result.Body!.transformToString());

    // Format the transcription
    const rawTranscripts: Transcript[] = output.results.audio_segments.map(
      (item: { transcript: string; speaker_label?: string }) => ({
        speakerLabel: item.speaker_label,
        transcript: item.transcript,
      })
    );
    // If the speaker is continuous, merge them
    const transcripts = rawTranscripts
      .reduce((prev, item) => {
        if (
          prev.length === 0 ||
          item.speakerLabel !== prev[prev.length - 1].speakerLabel
        ) {
          prev.push({
            speakerLabel: item.speakerLabel,
            transcript: item.transcript,
          });
        } else {
          prev[prev.length - 1].transcript += ' ' + item.transcript;
        }
        return prev;
      }, [] as Transcript[])
      .map((item) => ({
        ...item,
        // There is a space between phrases; Japanese and Chinese are written
        // without spaces between words, so remove it for them
        transcript: ['ja-JP', 'zh-CN'].includes(output.results.language_code)
          ? item.transcript.replace(/ /g, '')
          : item.transcript,
      }));

    const transcription: GetTranscriptionResponse = {
      status: res.TranscriptionJob?.TranscriptionJobStatus,
      languageCode: output.results.language_code,
      transcripts: transcripts,
    };

    return sendJson(response, 200, transcription);
  } else {
    return sendJson(response, 200, {
      status: res.TranscriptionJob?.TranscriptionJobStatus,
    });
  }
};
