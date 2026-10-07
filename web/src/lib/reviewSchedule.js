function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString();
}

export function normalizeStatus(status) {
  if (status === "learned") {
    return "mastered";
  }
  return status || "new";
}

export function isDue(item, now = Date.now()) {
  if (!item || !item.next_review_at) {
    return true;
  }
  return new Date(item.next_review_at).getTime() <= now;
}

export function dueQueue(list, now = Date.now()) {
  return (list || []).filter((item) => isDue(item, now));
}

export function masteredList(list) {
  return (list || []).filter((item) => normalizeStatus(item.learning_status) === "mastered");
}

export function afterCorrectReview(item) {
  const count = Number(item && item.successful_reviews ? item.successful_reviews : 0) + 1;
  let status = "learning";
  let interval = 1;
  if (count === 2) {
    interval = 3;
  } else if (count === 3) {
    status = "mastered";
    interval = 7;
  } else if (count === 4) {
    status = "mastered";
    interval = 14;
  } else if (count >= 5) {
    status = "mastered";
    interval = 30;
  }
  return {
    learning_status: status,
    successful_reviews: count,
    review_interval_days: interval,
    next_review_at: addDays(interval),
  };
}

export function afterIncorrectReview() {
  return {
    learning_status: "learning",
    successful_reviews: 0,
    review_interval_days: 1,
    next_review_at: addDays(1),
  };
}

export const SESSION_NEEDED = 2;
export const GAP_MISS = 3;
export const GAP_HIT = 5;

export function needsSessionPair(item) {
  return normalizeStatus(item && item.learning_status) !== "mastered";
}

export function insertLater(queue, card, gap) {
  const rest = Array.isArray(queue) ? queue.slice() : [];
  if (!card) {
    return rest;
  }
  if (rest.length === 0) {
    return [card];
  }
  let at = Number(gap);
  if (!Number.isFinite(at) || at < 1) {
    at = 1;
  }
  at = Math.min(at, rest.length);
  rest.splice(at, 0, card);
  return rest;
}

export function sessionAfterGrade(input) {
  const queue = (input && input.queue) || [];
  const sessionCounts = Object.assign({}, (input && input.sessionCounts) || {});
  const card = input && input.card;
  const knew = Boolean(input && input.knew);
  const practiceMastered = Boolean(input && input.practiceMastered);
  if (!card) {
    return {
      queue: queue,
      sessionCounts: sessionCounts,
      persist: null,
      nextCard: null,
      doneForToday: false,
    };
  }

  const rest = queue.filter(function (item) {
    return item.id !== card.id;
  });
  const pair = !practiceMastered && needsSessionPair(card);

  if (!knew) {
    sessionCounts[card.id] = 0;
    const persist = afterIncorrectReview();
    const nextCard = Object.assign({}, card, persist);
    return {
      queue: insertLater(rest, nextCard, GAP_MISS),
      sessionCounts: sessionCounts,
      persist: persist,
      nextCard: nextCard,
      doneForToday: false,
    };
  }

  if (!pair) {
    const persist = afterCorrectReview(card);
    const nextCard = Object.assign({}, card, persist);
    return {
      queue: rest,
      sessionCounts: sessionCounts,
      persist: persist,
      nextCard: nextCard,
      doneForToday: true,
    };
  }

  const nextCount = Number(sessionCounts[card.id] || 0) + 1;
  sessionCounts[card.id] = nextCount;
  if (nextCount >= SESSION_NEEDED) {
    const persist = afterCorrectReview(card);
    const nextCard = Object.assign({}, card, persist);
    return {
      queue: rest,
      sessionCounts: sessionCounts,
      persist: persist,
      nextCard: nextCard,
      doneForToday: true,
    };
  }

  return {
    queue: insertLater(rest, card, GAP_HIT),
    sessionCounts: sessionCounts,
    persist: null,
    nextCard: card,
    doneForToday: false,
  };
}

export function reviewSnapshotFields(item) {
  if (!item) {
    return null;
  }
  return {
    learning_status: item.learning_status,
    successful_reviews: item.successful_reviews,
    review_interval_days: item.review_interval_days,
    next_review_at: item.next_review_at,
  };
}

export function patchForManualStatus(status) {
  const next = normalizeStatus(status);
  if (next === "learning") {
    return {
      learning_status: "learning",
      successful_reviews: 1,
      review_interval_days: 1,
      next_review_at: addDays(0),
    };
  }
  if (next === "mastered") {
    return {
      learning_status: "mastered",
      successful_reviews: 3,
      review_interval_days: 7,
      next_review_at: addDays(7),
    };
  }
  return {
    learning_status: "new",
    successful_reviews: 0,
    review_interval_days: 0,
    next_review_at: addDays(0),
  };
}
