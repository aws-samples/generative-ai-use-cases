import type * as echarts from 'echarts';
import { MAX_STRING_LENGTH } from '../validation';
import {
  PROTO_UNSAFE_KEYS,
  isPlainObject,
  MAX_TREE_DEPTH,
  MAX_TOOLTIP_ENFORCEMENT_DEPTH,
} from './safety';
import { MAX_SAFE_SYMBOL_SIZE } from './constants';

// Last reviewed: 2026-05-17
const BLOCKED_KEYS = new Set([
  ...PROTO_UNSAFE_KEYS,
  'graphic',
  'backgroundColor',
  'extraCssText',
  'rich',
  'toolbox',
  'brush',
  'dataset',
  'encode',
  'link',
  'sublink',
  'target',
  'renderItem',
  'labelLayout',
  'animationDelay',
  'animationDurationUpdate',
  'animationDelayUpdate',
]);

function isLikelyFunctionString(s: string): boolean {
  return /\b(?:function|Function)\s*\(|=>|\beval\s*\(|<\s*script|\bnew\s+Function\b/i.test(
    s
  );
}

function isSafeFormatterString(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_STRING_LENGTH &&
    !isLikelyFunctionString(value) &&
    isSafeStringValue(value)
  );
}

function isSafeSymbolSize(value: unknown): boolean {
  const isFiniteInRange = (n: unknown) =>
    typeof n === 'number' &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= MAX_SAFE_SYMBOL_SIZE;
  if (isFiniteInRange(value)) return true;
  return (
    Array.isArray(value) && value.length === 2 && value.every(isFiniteInRange)
  );
}

const URL_LIKE_RE =
  /^\s*(?:https?:|data:|blob:|javascript:|file:|image:|path:|\/\/)/i;

function isSafeStringValue(value: string): boolean {
  if (URL_LIKE_RE.test(value)) return false;
  if (/javascript\s*:/i.test(value)) return false;
  return true;
}

export function sanitizeOptions(
  obj: unknown,
  maxDepth = MAX_TREE_DEPTH
): unknown {
  return sanitizeInternal(obj, maxDepth, 0);
}

function sanitizeInternal(
  obj: unknown,
  maxDepth: number,
  depth: number
): unknown {
  if (depth >= maxDepth) return undefined;
  if (typeof obj === 'function') return undefined;
  if (Array.isArray(obj))
    // Strings in arrays get the same check as object values (e.g. a list of
    // symbols); an unsafe one becomes '' so the other items keep their index.
    return obj.map((item) =>
      typeof item === 'string'
        ? isSafeStringValue(item)
          ? item
          : ''
        : sanitizeInternal(item, maxDepth, depth + 1)
    );
  if (isPlainObject(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (BLOCKED_KEYS.has(key)) continue;

      if (key === 'formatter') {
        if (isSafeFormatterString(value)) result[key] = value;
        continue;
      }

      if (key === 'symbolSize') {
        if (isSafeSymbolSize(value)) result[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        if (isSafeStringValue(value)) result[key] = value;
        continue;
      }

      const sanitized = sanitizeInternal(value, maxDepth, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return obj;
}

function enforceTooltipSafetyDeep(obj: unknown, depth = 0): unknown {
  if (depth > MAX_TOOLTIP_ENFORCEMENT_DEPTH || !obj || typeof obj !== 'object')
    return obj;
  if (Array.isArray(obj))
    return obj.map((item) => enforceTooltipSafetyDeep(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === 'tooltip' && value && typeof value === 'object') {
      if (Array.isArray(value)) {
        result[key] = value.map((t) =>
          t && typeof t === 'object'
            ? { ...t, renderMode: 'richText' as const, confine: true }
            : t
        );
      } else {
        result[key] = {
          ...value,
          renderMode: 'richText' as const,
          confine: true,
        };
      }
    } else {
      result[key] = enforceTooltipSafetyDeep(value, depth + 1);
    }
  }
  return result;
}

export function enforceTooltipSafety(
  opt: echarts.EChartsOption
): echarts.EChartsOption {
  return enforceTooltipSafetyDeep(opt) as echarts.EChartsOption;
}
