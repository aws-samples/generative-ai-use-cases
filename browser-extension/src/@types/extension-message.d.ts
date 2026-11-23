import { SystemContext } from './chat';

export type MessagePayload =
  | {
      type: 'CHAT-OPEN';
    }
  | {
      type: 'CHAT-CLOSE';
    }
  | {
      type: 'CONTENT';
      content: string;
    }
  | {
      type: 'SYSTEM-CONTEXT';
      systemContext: SystemContext;
    }
  | {
      // From the context menu: open the chat with the text of the page
      type: 'PAGE-CONTENT';
      systemContext: SystemContext;
    };
