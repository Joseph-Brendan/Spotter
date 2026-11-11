function levenshtein(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }

    previous = current;
  }

  return previous[right.length];
}

/**
 * Scores a value against a query using case-insensitive substring, token,
 * typo (Levenshtein), and subsequence matching. A score of 0 means no match.
 */
export function fuzzyScore(value: string, query: string): number {
  const haystack = value.trim().toLowerCase();
  const needle = query.trim().toLowerCase();

  if (!haystack || !needle) {
    return 0;
  }

  if (haystack === needle) {
    return 100;
  }

  if (haystack.startsWith(needle)) {
    return 85;
  }

  if (haystack.includes(needle)) {
    return 70;
  }

  const tokens = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  let best = 0;

  for (const token of tokens) {
    if (token === needle) {
      best = Math.max(best, 90);
      continue;
    }

    if (token.startsWith(needle)) {
      best = Math.max(best, 75);
      continue;
    }

    if (token.includes(needle)) {
      best = Math.max(best, 60);
      continue;
    }

    const distance = levenshtein(needle, token);
    const allowedDistance =
      needle.length <= 4 ? 1 : needle.length <= 7 ? 2 : 3;

    if (distance <= allowedDistance) {
      best = Math.max(best, 50 - distance * 5);
    }
  }

  if (needle.length < 3) {
    return best;
  }

  let cursor = 0;
  let gaps = 0;
  let previousIndex = -1;

  for (const character of needle) {
    const index = haystack.indexOf(character, cursor);

    if (index === -1) {
      return best;
    }

    if (previousIndex !== -1) {
      gaps += index - previousIndex - 1;
    }

    previousIndex = index;
    cursor = index + 1;
  }

  return Math.max(best, 40 - Math.min(gaps, 30));
}
