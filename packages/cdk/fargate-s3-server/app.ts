import express, { Request, Response } from 'express';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const app = express();
const port = 8080;

const BUCKET = process.env.BUCKET_NAME || '';

const s3Client = new S3Client({});

app.get('/healthcheck', (_req: Request, res: Response) => {
  res.status(200).send();
});

app.get('{*key}', async (req: Request, res: Response) => {
  let key = req.path;

  if (key.startsWith('/')) {
    key = key.substring(1);
  }

  console.log(key);

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    // Check the existance of the key
    await s3Client.send(headCommand);

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const { Body, ContentType, ContentLength } =
      await s3Client.send(getCommand);

    if (!Body) {
      throw new Error('S3 object body is empty');
    }

    res.set('Content-Type', ContentType || 'application/octet-stream');

    if (ContentLength) {
      res.set('Content-Length', ContentLength.toString());
    }

    const readableBody = Body as Readable;
    readableBody.pipe(res);
  } catch (err) {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET,
        Key: 'index.html',
      });

      const { Body } = await s3Client.send(getCommand);

      if (!Body) {
        throw new Error('index.html body is empty');
      }

      res.set('Content-Type', 'text/html');

      const readableBody = Body as Readable;
      readableBody.pipe(res);
    } catch (indexErr) {
      console.error('Failed to fetch index.html', indexErr);
      res.status(500).send('Internal Server Error');
    }
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Start listening on http://0.0.0.0:${port}...`);
});
