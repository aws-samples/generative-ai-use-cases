import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  VoiceId,
  LanguageCode,
} from '@aws-sdk/client-polly';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  SynthesizeSpeechRequest,
  SynthesizeSpeechResponse,
} from 'generative-ai-use-cases';
import {
  OUTPUT_FORMATS,
  buildFileName,
  buildSpeechInput,
  isWithinRequestLimit,
  mapPollyError,
  validateSynthesizeRequestDetailed,
} from './utils/pollyUtils';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const badRequest = (
  message: string,
  code = 'INVALID_REQUEST'
): APIGatewayProxyResult => ({
  statusCode: 400,
  headers,
  body: JSON.stringify({ message, code }),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Errors after Polly returned the audio come from S3 (PutObject / presign)
  let stage: 'polly' | 'storage' = 'polly';
  try {
    let req: Partial<SynthesizeSpeechRequest>;
    try {
      req = JSON.parse(event.body ?? '');
    } catch {
      return badRequest('Request body must be valid JSON.');
    }

    const validationError = validateSynthesizeRequestDetailed(req);
    if (validationError) {
      return badRequest(validationError.message, validationError.code);
    }
    const {
      text,
      textType,
      voiceId,
      engine,
      languageCode,
      outputFormat,
      speed,
      timestamp,
    } = req as SynthesizeSpeechRequest;

    const input = buildSpeechInput(text, speed, textType);
    if (!isWithinRequestLimit(input.text)) {
      const mapped = mapPollyError({ name: 'TextLengthExceededException' });
      return badRequest(mapped.message, mapped.code);
    }
    const format = OUTPUT_FORMATS[outputFormat];

    const polly = new PollyClient({});
    const speech = await polly.send(
      new SynthesizeSpeechCommand({
        Text: input.text,
        TextType: input.textType,
        VoiceId: voiceId as VoiceId,
        Engine: engine,
        LanguageCode: languageCode as LanguageCode,
        OutputFormat: outputFormat,
      })
    );

    if (!speech.AudioStream) {
      throw new Error('Polly returned an empty audio stream.');
    }
    const audio = await speech.AudioStream.transformToByteArray();
    stage = 'storage';

    // Same key convention as getFileUploadSignedUrl: XXXXX/filename
    const fileName = buildFileName(voiceId, format.extension, timestamp);
    const key = `${uuidv4()}/${fileName}`;

    const s3 = new S3Client({});
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
        Body: audio,
        ContentType: format.contentType,
      })
    );

    // Same presigned GET as getFileDownloadSignedUrl. The attachment
    // disposition makes the browser save it with a proper name, while
    // <audio> playback is not affected by it.
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
        ResponseContentType: format.contentType,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
      }),
      { expiresIn: 3600 }
    );

    const response: SynthesizeSpeechResponse = {
      key,
      fileName,
      url,
      contentType: format.contentType,
      characters: speech.RequestCharacters ?? Array.from(text).length,
    };
    return { statusCode: 200, headers, body: JSON.stringify(response) };
  } catch (error) {
    console.log(error);
    const { statusCode, message, code } = mapPollyError(error, {
      storage: stage === 'storage',
    });
    return {
      statusCode,
      headers,
      body: JSON.stringify({ message, code }),
    };
  }
};
