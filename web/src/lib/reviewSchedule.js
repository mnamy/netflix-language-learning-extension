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
