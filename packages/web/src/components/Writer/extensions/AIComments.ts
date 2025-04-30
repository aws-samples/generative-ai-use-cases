import { Editor } from '@tiptap/react';
import { DocumentComment } from 'generative-ai-use-cases';
import { create } from 'zustand';
import useWriter from '../../../hooks/useWriter';
import { removeAIHighlight } from 'novel';
import { toast } from 'sonner';
import { TFunction } from 'i18next';

const REGEX_BRACKET = /\{(?:[^{}])*\}/g;
const REGEX_ZENKAKU =
  /[Ａ-Ｚａ-ｚ０-９！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝]/g;
const highlightColor = '#fdebeb';

type CommentState = {
  comments: DocumentComment[];
  commentState: { [name: string]: boolean };
  filteredComments: DocumentComment[];
  loading: boolean;
  setComments: (comments: DocumentComment[]) => void;
  setCommentState: (state: { [name: string]: boolean }) => void;
  addCommentState: (excerpt: string) => void;
  setFilteredComments: (filteredComments: DocumentComment[]) => void;
  setLoading: (loading: boolean) => void;
  clearAll: () => void;
};

const useCommentStore = create<CommentState>((set) => ({
  comments: [],
  commentState: {},
  filteredComments: [],
  loading: false,
  setComments: (comments) => set({ comments }),
  setCommentState: (commentState) => set({ commentState }),
  addCommentState: (excerpt) =>
    set((state) => ({
      commentState: { ...state.commentState, [excerpt]: true },
    })),
  setFilteredComments: (filteredComments) => set({ filteredComments }),
  setLoading: (loading) => set({ loading }),
  clearAll: () =>
    set({
      comments: [],
      commentState: {},
      filteredComments: [],
      loading: false,
    }),
}));

export class AICommentManager {
  private editor: Editor;
  private write: ReturnType<typeof useWriter>['write'];
  private t: TFunction;

  constructor(
    editor: Editor,
    write: ReturnType<typeof useWriter>['write'],
    t: TFunction
  ) {
    this.editor = editor;
    this.write = write;
    this.t = t;
  }

  // Search for the position of the text
  findTextPosition(searchText: string): { from: number; to: number }[] {
    const doc = this.editor.state.doc;
    const matches: { from: number; to: number }[] = [];

    // Escape the regular expression
    const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow flexible matching of newlines and spaces
    const searchRegex = new RegExp(
      escapedSearchText
        .replace(/\n/g, '[\\s\\n]*') // Match newlines with any whitespace or newline
        .replace(/\s+/g, '[\\s\\n]*'), // Match spaces with any whitespace or newline
      'g'
    );

    // Collect the text and position information
    let fullText = '';
    const positions: number[] = [];

    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        fullText += node.text;
        for (let i = 0; i < node.text.length; i++) {
          positions.push(pos + i);
        }
      } else if (
        node.type.name === 'paragraph' ||
        node.type.name === 'hardBreak'
      ) {
        // Paragraphs and hard breaks are treated as newlines
        fullText += '\n';
        positions.push(pos);
      }
    });

    // Execute the search with the regular expression
    let match;
    while ((match = searchRegex.exec(fullText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Get the actual position in the document
      if (positions[start] !== undefined && positions[end - 1] !== undefined) {
        matches.push({
          from: positions[start],
          to: positions[end - 1] + 1,
        });
      }
    }

    return matches;
  }

  // Filter the comments
  private updateFilteredComments() {
    const { comments, commentState } = useCommentStore.getState();
    const filteredComments = comments.filter(
      (x) =>
        x.excerpt &&
        commentState[x.excerpt] === undefined &&
        x.excerpt !== x.replace
    );
    useCommentStore.getState().setFilteredComments(filteredComments);
  }

  // Clear the comments
  clearComments() {
    useCommentStore.getState().clearAll();
    removeAIHighlight(this.editor);
  }

  // Delete the comments
  removeComment(comment: DocumentComment) {
    // Update the comment state
    useCommentStore.getState().addCommentState(comment.excerpt);
    this.updateFilteredComments();

    // Update the highlight: delete all and reflect the latest state
    removeAIHighlight(this.editor);
    const filteredComments = useCommentStore.getState().filteredComments;
    const chain = this.editor.chain();
    filteredComments.forEach((comment) => {
      const matches = this.findTextPosition(comment.excerpt);
      if (matches.length === 0) return;
      for (const { from, to } of matches) {
        chain
          .setTextSelection({ from, to })
          .setAIHighlight({ color: highlightColor });
      }
    });
    chain.run();

    // If there are no comments, clear the comments (highlight may remain)
    if (useCommentStore.getState().filteredComments.length === 0) {
      this.clearComments();
    }
  }

  // Execute the correction pointed out by the comment
  replaceSentence(comment: DocumentComment) {
    const matches = this.findTextPosition(comment.excerpt);
    if (matches.length === 0 || !comment.replace) return;
    const chain = this.editor.chain();
    for (const { from, to } of matches) {
      chain
        .setTextSelection({ from, to })
        .unsetAIHighlight()
        .insertContentAt({ from, to }, comment.replace);
    }
    chain.run();
    this.removeComment(comment);
  }

  // Focus on the comment block when clicked
  focusComment(comment: DocumentComment) {
    const matches = this.findTextPosition(comment.excerpt);
    if (matches.length === 0) return;
    const { from, to } = matches[0];
    this.editor.chain().setTextSelection({ from, to }).focus().run();
  }

  // Add the highlight
  private addHighlight(comment: DocumentComment) {
    if (!comment.excerpt) return;
    const matches = this.findTextPosition(comment.excerpt);
    if (matches.length === 0) return;
    for (const { from, to } of matches) {
      this.editor
        .chain()
        .setTextSelection({ from, to })
        .setAIHighlight({ color: highlightColor })
        .run();
    }
  }

  // Update the comments in real time by extracting the JSON part
  private handleResponse(response: string) {
    const currentComments = useCommentStore.getState().comments;
    const newComments = [...response.matchAll(REGEX_BRACKET)]
      .map((x) => {
        try {
          return JSON.parse(x[0]) as DocumentComment;
        } catch (error) {
          console.error(error, x[0]);
          return { excerpt: '', type: 'error' } as DocumentComment;
        }
      })
      .filter((comment) => comment.excerpt);

    if (newComments.length !== currentComments.length) {
      useCommentStore.getState().setComments(newComments);
      this.updateFilteredComments();
      newComments.slice(currentComments.length).forEach((comment) => {
        this.addHighlight(comment);
      });
    }
  }

  // Execute the configuration
  async execAnnotation() {
    if (useCommentStore.getState().loading) return;

    // Convert full-width characters to half-width characters
    const cleanedMarkdown = this.editor.storage.markdown
      .getMarkdown()
      .replace(REGEX_ZENKAKU, (s: string) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      })
      .replace(/[‐－―]/g, '-')
      .replace(/[～〜]/g, '~')
      .replace(/[""]/g, "'") // replace double quote since Claude does not escape double quote inside json
      // eslint-disable-next-line no-irregular-whitespace
      .replace(/　/g, ' ');
    this.editor.commands.setContent(cleanedMarkdown);

    // Clear the comments
    this.clearComments();
    useCommentStore.getState().setLoading(true);

    // Get the comments
    const text = this.editor.getText();
    try {
      let buffer = '';
      for await (const chunk of this.write(text, 'comment')) {
        buffer += chunk.text;
        this.handleResponse(buffer);
      }
    } finally {
      useCommentStore.getState().setLoading(false);
      if (useCommentStore.getState().comments.length === 0) {
        toast.error(this.t('common.errorNoSuggestions'));
      } else {
        toast.success(this.t('common.reviewComplete'));
      }
    }
  }
}

export const useComments = () => {
  const comments = useCommentStore((state) => state.comments);
  const commentState = useCommentStore((state) => state.commentState);
  const filteredComments = useCommentStore((state) => state.filteredComments);
  const loading = useCommentStore((state) => state.loading);

  return {
    comments,
    commentState,
    filteredComments,
    loading,
  };
};
