export function turn(role, line, zh) {
  return {
    role,
    line,
    zh
  };
}

export function card(id, options) {
  return {
    id,
    isCore: options.isCore ?? false,
    tags: options.tags ?? [],
    coachNote: options.coachNote ?? null,
    turns: options.turns
  };
}

export function word(id, line, zh, tags = []) {
  return {
    id,
    line,
    zh,
    tags
  };
}

export function lesson(id, code, title, overview, cards, wordBank = []) {
  return {
    id,
    code,
    title,
    overview,
    cards,
    wordBank
  };
}
