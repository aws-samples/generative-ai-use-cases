import {
  AIHighlight,
  CharacterCount,
  CodeBlockLowlight,
  Color,
  GlobalDragHandle,
  HighlightExtension,
  HorizontalRule,
  StarterKit,
  TaskItem,
  TaskList,
  TextStyle,
  TiptapLink,
  TiptapUnderline,
  Twitter,
  Youtube,
} from 'novel';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';

//TODO I am using cx here to get tailwind autocomplete working, idk if someone else can write a regex to just capture the class key in objects
const aiHighlight = AIHighlight;

//You can overwrite the placeholder with your own configuration
// const placeholder = Placeholder;
const placeholder = Placeholder.configure({
  placeholder: ({ node }) => {
    if (node.type.name === 'heading') {
      return `Heading ${node.attrs.level}`;
    }
    return "Press '/' for commands";
  },
  includeChildren: true,
});

const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class:
      'text-muted-foreground underline underline-offset-[3px] hover:text-primary transition-colors cursor-pointer',
  },
});

const taskList = TaskList.configure({
  HTMLAttributes: {
    class: 'not-prose pl-2',
  },
});
const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: 'flex gap-2 items-start my-4',
  },
  nested: true,
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: 'mt-4 mb-6 border-t border-muted-foreground',
  },
});

const starterKit = StarterKit.configure({
  bulletList: {
    HTMLAttributes: {
      class: 'list-disc list-outside leading-3 -mt-2',
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: 'list-decimal list-outside leading-3 -mt-2',
    },
  },
  listItem: {
    HTMLAttributes: {
      class: 'leading-normal -mb-2',
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: 'border-l-4 border-primary',
    },
  },
  codeBlock: {
    HTMLAttributes: {
      class:
        'rounded-md bg-muted text-muted-foreground border p-5 font-mono font-medium',
    },
  },
  code: {
    HTMLAttributes: {
      class: 'rounded-md bg-muted px-1.5 py-1 font-mono font-medium',
      spellcheck: 'false',
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: '#DBEAFE',
    width: 4,
  },
  gapcursor: false,
});

const codeBlockLowlight = CodeBlockLowlight.configure({
  // configure lowlight: common /  all / use highlightJS in case there is a need to specify certain language grammars only
  // common: covers 37 language grammars which should be good enough in most cases
  lowlight: createLowlight(common),
});

const youtube = Youtube.configure({
  HTMLAttributes: {
    class: 'rounded-lg border border-muted',
  },
  inline: false,
});

const twitter = Twitter.configure({
  HTMLAttributes: {
    class: 'not-prose',
  },
  inline: false,
});

const characterCount = CharacterCount.configure();

const markdownExtension = Markdown.configure({
  html: true,
  tightLists: true,
  tightListClass: 'tight',
  bulletListMarker: '-',
  linkify: false,
  breaks: false,
  transformPastedText: false,
  transformCopiedText: true,
});

export const defaultExtensions = [
  starterKit,
  placeholder,
  tiptapLink,
  taskList,
  taskItem,
  horizontalRule,
  aiHighlight,
  codeBlockLowlight,
  youtube,
  twitter,
  characterCount,
  TiptapUnderline,
  markdownExtension,
  HighlightExtension,
  TextStyle,
  Color,
  GlobalDragHandle,
];
