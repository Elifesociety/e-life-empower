export function moveQuestion<T extends { sort_order: number }>(
  questions: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= questions.length ||
    toIndex >= questions.length ||
    fromIndex === toIndex
  ) {
    return questions;
  }

  const reordered = [...questions];
  const [movedQuestion] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, movedQuestion);

  return reordered.map((question, sort_order) => ({ ...question, sort_order }));
}