export type CommentCard = {
  // Top of the line the comment points at, from the top of the comment list.
  // null when the excerpt is no longer in the text.
  textTop: number | null;
  height: number;
};

/**
 * Places the comment cards next to the text they point at, without overlap.
 * A card goes at the line of its excerpt, or right below the previous card
 * when that one is still in the way. A card whose excerpt is not in the text
 * goes right below the previous card.
 */
export const layoutCommentCards = (
  cards: CommentCard[]
): { tops: number[]; height: number } => {
  let bottom = 0;
  const tops = cards.map(({ textTop, height }) => {
    const top = Math.max(textTop ?? bottom, bottom);
    bottom = top + height;
    return top;
  });
  return { tops, height: bottom };
};
