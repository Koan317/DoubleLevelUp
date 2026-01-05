export function aiPlay(hand, lead, state, role) {
  // 初级 AI：按你描述的逻辑
  if (!lead) {
    return [hand.find(c => !state.isTrump(c)) || hand[0]];
  }
  return [hand[0]];
}
