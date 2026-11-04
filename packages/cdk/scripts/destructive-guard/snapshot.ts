// Reads the CloudFormation templates back out of a Jest snapshot file
// (packages/cdk/test/__snapshots__/*.snap) without evaluating it.
//
// The snapshot serializer (test/snapshot-plugin.ts) and
// `snapshotFormat.escapeString` keep quotes escaped, so pretty-format's output
// differs from JSON only in trailing commas and in raw control characters
// inside strings. Both are fixed by a small tokenizer that tracks whether it is
// inside a string.
import { CfnTemplate } from './compare';

const ENTRY =
  /^exports\[`((?:[^`\\]|\\.)*)`\] = `((?:[^`\\]|\\.)*)`;$/gms;

// Jest escapes backslashes, backticks and `${` inside the template literal.
const unescapeTemplateLiteral = (value: string): string =>
  value.replace(/\\(\\|`|\$(?=\{))/g, '$1');

const CONTROL_ESCAPES: Readonly<Record<string, string>> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/** Converts one pretty-format value printed with escapeString into JSON. */
export const prettyFormatToJson = (value: string): string => {
  let out = '';
  let inString = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (inString) {
      if (c === '\\') {
        out += c + value[++i];
      } else if (c === '"') {
        inString = false;
        out += c;
      } else {
        out += CONTROL_ESCAPES[c] ?? c;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === ',') {
      // Drop a trailing comma: the next non-space character closes the
      // container.
      let j = i + 1;
      while (j < value.length && /\s/.test(value[j])) j++;
      if (value[j] === '}' || value[j] === ']') continue;
    }
    out += c;
  }
  return out;
};

export class SnapshotFormatError extends Error {}

/** Returns the templates in a snapshot file, keyed by snapshot name. */
export const parseSnapshotFile = (content: string): Map<string, CfnTemplate> => {
  const templates = new Map<string, CfnTemplate>();
  for (const match of content.matchAll(ENTRY)) {
    const key = unescapeTemplateLiteral(match[1]);
    const value = unescapeTemplateLiteral(match[2]);
    try {
      templates.set(key, JSON.parse(prettyFormatToJson(value)) as CfnTemplate);
    } catch (e) {
      throw new SnapshotFormatError(
        `snapshot "${key}" is not a template: ${(e as Error).message}`
      );
    }
  }
  return templates;
};
