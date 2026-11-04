// Masks values that change on every synth or whenever asset content changes,
// so the snapshot only fails when the infrastructure itself changes:
// - Lambda zip and container image hashes
// - the `randomString` property that RemoteOutputs (cdk-remote-stack) adds to
//   its custom resource on every synth
//
// Only those values are handled here. Everything else goes through Jest's
// default printer, so string escaping follows `snapshotFormat` in
// jest.config.ts and each snapshot can be read back as a template.
const ZIP_HASH = /[A-Fa-f0-9]{64}\.zip/g;
const CONTAINER_HASH = /(container-assets-\d+-[^:]+:)[A-Fa-f0-9]{64}/g;
const RANDOM_STRING_REPLACED = 'RANDOM-STRING-REPLACED';

type ObjectWithRandomString = Record<string, unknown> & {
  randomString: string;
};

const mask = (value: string): string =>
  value
    .replace(ZIP_HASH, 'HASH-REPLACED.zip')
    .replace(CONTAINER_HASH, '$1HASH-REPLACED');

const hasRandomString = (value: unknown): value is ObjectWithRandomString =>
  typeof value === 'object' &&
  value !== null &&
  'randomString' in value &&
  (value as ObjectWithRandomString).randomString !== RANDOM_STRING_REPLACED;

module.exports = {
  test(value: unknown): value is string | ObjectWithRandomString {
    return (
      (typeof value === 'string' && mask(value) !== value) ||
      hasRandomString(value)
    );
  },
  serialize(
    value: string | ObjectWithRandomString,
    config: Record<string, unknown>,
    indentation: string,
    depth: number,
    refs: unknown[],
    printer: (val: unknown, ...args: unknown[]) => string
  ): string {
    const masked =
      typeof value === 'string'
        ? mask(value)
        : { ...value, randomString: RANDOM_STRING_REPLACED };
    return printer(masked, config, indentation, depth, refs);
  },
};
