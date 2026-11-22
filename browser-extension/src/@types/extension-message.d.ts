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
    }
  | {
      // From the context menu: open the chat with a screenshot of the tab
      type: 'SCREENSHOT';
      image: string;
      systemContext: SystemContext;
    }
  | {
      // To the chat: an image (data URL) to send with the message, '' for none
      type: 'IMAGE';
      image: string;
    };
