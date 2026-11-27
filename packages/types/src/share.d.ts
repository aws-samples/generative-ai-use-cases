import { PrimaryKey } from './base';

export type ShareId = PrimaryKey & {
  shareId: string;
};

export type UserIdAndChatId = PrimaryKey & {
  userId: string;
  chatId: string;
  // The chat owner's Cognito sub, the owner segment of their file keys.
  // Missing on links created before it was recorded.
  ownerSub?: string;
};
