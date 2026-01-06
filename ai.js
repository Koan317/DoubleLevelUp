import { analyzePlay } from "./pattern.js";

export function aiPlay(hand, leadPattern, state, role) {
  const sorted = [...hand].sort(
    (a, b) => analyzePlay([a], state).power - analyzePlay([b], state).power
  );

  // 首家：优先出副牌里的大牌
  if (!leadPattern) {
    return [sorted[sorted.length - 1]];
  }

  // 尽量压过
  for (const card of sorted) {
    const p = analyzePlay([card], state);
    if (p.power > leadPattern.power) {
      return [card];
    }
  }

  // 压不了，出最小
  return [sorted[0]];
}
