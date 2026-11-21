// Usage (from packages/cdk):
//   npm run models:verify -- --model <id-part>[,<id-part>...] [--probe] [--region <region>]
//   npm run models:verify -- --all
//
// Calls the real backend functions (lambda/utils/bedrockApi) against Amazon
// Bedrock for each text model in modelMetadata and reports which capabilities
// actually work: plain chat, streaming, reasoning, image and document input.
// Unit tests only build the request; this catches requests that Bedrock rejects
// (for example a parameter a model does not accept).
//
// It uses your AWS credentials and bills a few tokens per call, so it never
// runs without --model or --all. It makes no changes to any file.
//
// --model   run models whose ID contains any of the comma-separated parts
// --all     run every text model
// --probe   also try image and document input on models whose flags say no,
//           and report the ones that work (the flag may be enabled)
// --region  region to call for every model, instead of choosing one per model
//           (a prefix picks its region; a plain ID uses the first region that
//           offers it)
// --default-region  region tried first for plain model IDs (default:
//           AWS_REGION or us-east-1)
//
// Exit code is 1 when a capability promised by the flags failed.
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { modelMetadata } from '@generative-ai-use-cases/common';
import { Model, UnrecordedMessage } from 'generative-ai-use-cases';
import {
  CaseKind,
  planCases,
  PlannedCase,
  reasoningParameters,
  CANDIDATE_REGIONS,
  pickRegion,
} from './plan';

type Outcome = { ok: boolean; detail: string };

const CONCURRENCY = 3;
// A model that never answers must not stall the whole run.
const CASE_TIMEOUT_MS = 90_000;
const USECASE_ID = '/chat';

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

// A 64x64 solid red PNG, built here so the check needs no asset file.
const redPng = (): string => {
  const size = 64;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buffer: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // RGB
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array(size).fill([255, 0, 0]).flat()),
  ]);
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
};

const messagesFor = (kind: CaseKind): UnrecordedMessage[] => {
  const system: UnrecordedMessage = {
    role: 'system',
    content: 'You are a helpful assistant.',
  };
  if (kind === 'image') {
    return [
      system,
      {
        role: 'user',
        content: 'What color is this image? Answer in one word.',
        extraData: [
          {
            type: 'image',
            name: 'red.png',
            source: {
              type: 'base64',
              mediaType: 'image/png',
              data: redPng(),
            },
          },
        ],
      },
    ];
  }
  if (kind === 'document') {
    return [
      system,
      {
        role: 'user',
        content: 'What is the code word in the document? Answer in one word.',
        extraData: [
          {
            type: 'file',
            name: 'note.txt',
            source: {
              type: 'base64',
              mediaType: 'text/plain',
              data: Buffer.from('The code word is BANANA.').toString('base64'),
            },
          },
        ],
      },
    ];
  }
  return [system, { role: 'user', content: 'Reply with the single word OK.' }];
};

const errorDetail = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 200);
};

const main = async () => {
  const filters = (arg('model') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (filters.length === 0 && !flag('all')) {
    console.error('Pass --model <id-part>[,<id-part>...] or --all.');
    process.exitCode = 2;
    return;
  }

  const defaultRegion =
    arg('default-region') ?? process.env.AWS_REGION ?? 'us-east-1';
  const regionOverride = arg('region');
  const probe = flag('probe');

  // Which regions offer which model IDs, read with the AWS CLI. Only needed for
  // plain model IDs; a region that cannot be read is skipped.
  const offeredIn: Record<string, Set<string>> = {};
  let offeredInLoaded = false;
  const loadOfferedIn = () => {
    // Read once, even when every region fails (for example, expired credentials).
    if (offeredInLoaded) return;
    offeredInLoaded = true;
    for (const region of new Set([defaultRegion, ...CANDIDATE_REGIONS])) {
      try {
        const output = execFileSync(
          'aws',
          [
            'bedrock',
            'list-foundation-models',
            '--region',
            region,
            '--output',
            'json',
          ],
          { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
        );
        // A plain model ID is only callable where it supports on-demand use.
        offeredIn[region] = new Set(
          (
            JSON.parse(output).modelSummaries as {
              modelId: string;
              inferenceTypesSupported: string[];
            }[]
          )
            .filter(({ inferenceTypesSupported }) =>
              inferenceTypesSupported.includes('ON_DEMAND')
            )
            .map(({ modelId }) => modelId)
        );
      } catch {
        // Not enabled or not reachable in this region
      }
    }
  };

  const targets: Model[] = Object.entries(modelMetadata)
    .filter(([, metadata]) => metadata.flags.text)
    .map(([modelId]) => modelId)
    .filter(
      (modelId) =>
        flag('all') || filters.some((filter) => modelId.includes(filter))
    )
    .map((modelId) => {
      if (!regionOverride) loadOfferedIn();
      return {
        type: 'bedrock' as const,
        modelId,
        region:
          regionOverride ?? pickRegion({ modelId, defaultRegion, offeredIn }),
      };
    });
  if (targets.length === 0) {
    console.error('No text model matches.');
    process.exitCode = 2;
    return;
  }

  // lambda/utils/models reads these when it is imported, so set them first.
  process.env.MODEL_REGION = defaultRegion;
  process.env.MODEL_IDS = JSON.stringify(
    targets.map(({ modelId, region }) => ({ modelId, region }))
  );
  const { default: bedrockApi } = await import('../../lambda/utils/bedrockApi');

  const runCaseOnce = async (
    model: Model,
    kind: CaseKind
  ): Promise<Outcome> => {
    const flags = modelMetadata[model.modelId].flags;
    const target: Model =
      kind === 'reasoning'
        ? { ...model, modelParameters: reasoningParameters(flags) }
        : model;
    try {
      if (kind === 'stream') {
        let text = '';
        let errorCode: string | undefined;
        for await (const chunk of bedrockApi.invokeStream!(
          target,
          messagesFor(kind),
          USECASE_ID
        )) {
          const parsed = JSON.parse(chunk.replace(/\n$/, ''));
          text += parsed.text ?? '';
          if (parsed.errorCode) errorCode = parsed.errorCode;
        }
        // invokeStream turns a failure into an error chunk and logs the cause.
        return errorCode
          ? { ok: false, detail: `error chunk: ${errorCode}` }
          : { ok: true, detail: text.trim().slice(0, 40) };
      }
      const text = await bedrockApi.invoke(
        target,
        messagesFor(kind),
        USECASE_ID
      );
      return { ok: true, detail: text.trim().slice(0, 40) };
    } catch (error) {
      return { ok: false, detail: errorDetail(error) };
    }
  };

  const runCase = (model: Model, kind: CaseKind): Promise<Outcome> =>
    Promise.race([
      runCaseOnce(model, kind),
      new Promise<Outcome>((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: false,
              detail: `no response within ${CASE_TIMEOUT_MS / 1000}s`,
            }),
          CASE_TIMEOUT_MS
        ).unref()
      ),
    ]);

  const formatMarks = (results: [PlannedCase, Outcome][]): string =>
    results
      .map(([planned, outcome]) => {
        if (outcome.ok)
          return `${planned.kind}:ok${planned.expected ? '' : '(flag off)'}`;
        return `${planned.kind}:${planned.expected ? 'FAIL' : 'ng'}`;
      })
      .join('  ');

  type Row = { model: Model; results: [PlannedCase, Outcome][] };
  const rows: Row[] = [];
  const queue = [...targets];
  // invokeStream logs the cause of a failure with console.error; keep the
  // report readable and show only the summarized result.
  const originalError = console.error;
  console.error = () => {};
  const worker = async () => {
    for (let model = queue.shift(); model; model = queue.shift()) {
      const flags = modelMetadata[model.modelId].flags;
      const results: [PlannedCase, Outcome][] = [];
      for (const planned of planCases({ flags, probe })) {
        results.push([planned, await runCase(model, planned.kind)]);
      }
      rows.push({ model, results });
      originalError(`${model.modelId}  ${formatMarks(results)}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.error = originalError;

  rows.sort((a, b) => a.model.modelId.localeCompare(b.model.modelId));
  const failures: string[] = [];
  const enableCandidates: string[] = [];
  for (const { model, results } of rows) {
    console.log(`${model.modelId} [${model.region}]  ${formatMarks(results)}`);
    for (const [planned, outcome] of results) {
      if (!outcome.ok && planned.expected) {
        failures.push(`${model.modelId} ${planned.kind}: ${outcome.detail}`);
      }
      if (outcome.ok && !planned.expected) {
        enableCandidates.push(`${model.modelId} ${planned.kind}`);
      }
    }
  }

  console.log(
    `\n## Capabilities promised by flags but failing (${failures.length})`
  );
  for (const line of failures) console.log(`- ${line}`);
  if (probe) {
    console.log(
      `\n## Flag is off but the call worked (${enableCandidates.length})`
    );
    for (const line of enableCandidates) console.log(`- ${line}`);
  }
  if (failures.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
