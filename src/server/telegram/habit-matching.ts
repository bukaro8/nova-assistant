type HabitReplyCandidate = {
  validReplies: string[];
};

function normaliseHabitReply(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

function isCloseHabitReply(reply: string, validReply: string) {
  if (reply.length < 3 || validReply.length < 3) {
    return false;
  }

  if (validReply.startsWith(reply)) {
    return true;
  }

  const maxDistance = Math.min(reply.length, validReply.length) <= 5 ? 1 : 2;

  return levenshteinDistance(reply, validReply) <= maxDistance;
}

export function findHabitReplyMatches<T extends HabitReplyCandidate>(
  habits: T[],
  replyText: string,
) {
  const trimmedReply = replyText.trim();
  const exactMatches = habits.filter((habit) =>
    habit.validReplies.some((validReply) => validReply.trim() === trimmedReply),
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const normalisedReply = normaliseHabitReply(replyText);
  const caseInsensitiveMatches = habits.filter((habit) =>
    habit.validReplies.some(
      (validReply) => normaliseHabitReply(validReply) === normalisedReply,
    ),
  );

  if (caseInsensitiveMatches.length > 0) {
    return caseInsensitiveMatches;
  }

  return habits.filter((habit) =>
    habit.validReplies.some((validReply) =>
      isCloseHabitReply(normalisedReply, normaliseHabitReply(validReply)),
    ),
  );
}
