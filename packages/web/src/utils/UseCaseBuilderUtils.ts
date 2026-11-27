// Special character to identify when there is no label
// Empty string causes an error when inserting inputExample into DynamoDB
export const NOLABEL = 'NOLABEL';

export type BuilderItem = {
  inputType: string;
  label: string;
  options?: string;
  // retrieveKnowledgeBase only: the metadata filter as written (JSON), from
  // {{retrieveKnowledgeBase:label:{...}}}
  filter?: string;
  // The placeholder as written, for items with a filter
  placeholder?: string;
};

const KB_PREFIX = 'retrieveKnowledgeBase:';

// The end (exclusive) of the JSON object starting at `start`, or -1. Braces
// inside JSON strings do not count.
const jsonObjectEnd = (text: string, start: number): number => {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
};

// Where the filter JSON of a retrieveKnowledgeBase placeholder starts (the
// "{" after "label:"), counted from the start of the placeholder's body, or -1
const kbFilterStart = (body: string): number => {
  if (!body.startsWith(KB_PREFIX)) return -1;
  const end = body.indexOf('}');
  const colonBrace = body.indexOf(':{');
  return colonBrace !== -1 && (end === -1 || colonBrace < end)
    ? colonBrace + 1
    : -1;
};

export const SUPPORTED_TYPES: string[] = [
  'text',
  'form',
  'retrieveKendra',
  'retrieveKnowledgeBase',
  'select',
];

export const TEXT_FORM_TYPES: string[] = ['text', 'form', 'select'];

export const extractPlaceholdersFromPromptTemplate = (
  promptTemplate: string
): string[] => {
  const placeholders: string[] = [];
  const simple = /\{\{[^}]*\}\}/y;
  let i = 0;
  while ((i = promptTemplate.indexOf('{{', i)) !== -1) {
    // {{retrieveKnowledgeBase:label:{...}}}: the filter JSON has braces of its own
    const bodyStart = i + 2;
    const filterStart = kbFilterStart(promptTemplate.slice(bodyStart));
    if (filterStart !== -1) {
      const end = jsonObjectEnd(promptTemplate, bodyStart + filterStart);
      if (end !== -1 && promptTemplate.startsWith('}}', end)) {
        placeholders.push(promptTemplate.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }
    simple.lastIndex = i;
    const match = simple.exec(promptTemplate);
    if (match) {
      placeholders.push(match[0]);
      i += match[0].length;
    } else {
      i += 1;
    }
  }
  return placeholders;
};

export const getItemsFromPlaceholders = (
  placeholders: string[]
): BuilderItem[] => {
  return (
    placeholders
      .map((match) => {
        const body = match.replace(/^\{\{|\}\}$/g, '');
        const filterStart = kbFilterStart(body);
        if (filterStart !== -1) {
          const label = body.slice(KB_PREFIX.length, filterStart - 1);
          return {
            inputType: 'retrieveKnowledgeBase',
            label: label === '' ? NOLABEL : label,
            filter: body.slice(filterStart),
            placeholder: match,
          };
        }
        const [inputType, ...labels] = body.split(':');

        let label: string;
        let options: string | undefined = undefined;

        // Currently, only select allows options
        if (inputType === 'select') {
          if (labels.length >= 2) {
            const [tmpLabel, ...tmpOptions] = labels;
            label = tmpLabel;
            options = tmpOptions.join(':');
          } else {
            label = labels[0] ?? NOLABEL;
          }
        } else {
          if (labels.length === 0) {
            label = NOLABEL;
          } else {
            label = labels.join(':');
          }
        }

        return {
          inputType,
          label,
          options,
        };
      })
      .filter((item) => SUPPORTED_TYPES.includes(item.inputType))
      .filter(
        (elem, idx, self) =>
          self.findIndex(
            (e) =>
              e.inputType === elem.inputType &&
              e.label === elem.label &&
              e.filter === elem.filter
          ) === idx
      ) ?? []
  );
};

// Split the options of a select item. Whitespace around each option is
// dropped so that `{{select:label:A, B}}` offers "B" rather than " B",
// which input examples and typed values can match.
export const splitSelectOptions = (options?: string): string[] => {
  if (!options) return [];
  return options.split(',').map((o) => o.trim());
};

export const getTextFormItemsFromItems = (
  items: BuilderItem[]
): BuilderItem[] => {
  return items.filter((i) => TEXT_FORM_TYPES.includes(i.inputType));
};

export const getTextFormUniqueLabels = (items: BuilderItem[]): string[] => {
  return getTextFormItemsFromItems(items)
    .filter((elem, idx, self) => {
      return self.findIndex((e) => e.label === elem.label) === idx;
    })
    .map((item) => item.label);
};
