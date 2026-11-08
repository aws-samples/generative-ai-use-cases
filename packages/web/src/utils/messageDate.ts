/**
 * Parse a message's `createdDate` into a Date.
 *
 * Saved messages store `<epoch ms>#<index>`, where the index keeps messages
 * saved in the same request in order. Messages that are still streaming or
 * not yet saved have no `createdDate`; those return undefined.
 */
export const parseMessageDate = (createdDate?: string): Date | undefined => {
  if (!createdDate) return undefined;
  const ms = Number(createdDate.split('#')[0]);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return new Date(ms);
};
