// Masks values that change whenever asset content changes (Lambda zip and
// container image hashes), so the snapshot only fails when the infrastructure
// itself changes.
//
// Only strings that contain such a hash are handled here. Everything else goes
// through Jest's default printer, so string escaping follows `snapshotFormat`
// in jest.config.ts and each snapshot can be read back as a template.
const ZIP_HASH = /[A-Fa-f0-9]{64}\.zip/g;
const CONTAINER_HASH = /(container-assets-\d+-[^:]+:)[A-Fa-f0-9]{64}/g;

const mask = (value: string): string =>
  value
    .replace(ZIP_HASH, 'HASH-REPLACED.zip')
    .replace(CONTAINER_HASH, '$1HASH-REPLACED');

module.exports = {
  test(value: unknown): value is string {
    return typeof value === 'string' && mask(value) !== value;
  },
  serialize(
    value: string,
    config: Record<string, unknown>,
    indentation: string,
    depth: number,
    refs: unknown[],
    printer: (val: unknown, ...args: unknown[]) => string
  ): string {
    return printer(mask(value), config, indentation, depth, refs);
  },
};
