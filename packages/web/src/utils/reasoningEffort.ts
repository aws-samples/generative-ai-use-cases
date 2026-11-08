export const EFFORT_OPTIONS: {
  value: 'max' | 'xhigh' | 'high' | 'medium' | 'low';
  label: string;
}[] = [
  { value: 'max', label: 'Max' },
  { value: 'xhigh', label: 'X-High' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// The label of an effort, as the select shows it. No effort means high.
export const effortLabel = (
  effort: 'max' | 'xhigh' | 'high' | 'medium' | 'low' | undefined
): string =>
  EFFORT_OPTIONS.find((option) => option.value === (effort ?? 'high'))?.label ??
  'High';
