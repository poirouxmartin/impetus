export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400))
}

export function updateRating(
  rating: number,
  opponent: number,
  actual: 0 | 0.5 | 1,
  k = 32,
): { rating: number; delta: number } {
  const exp = expectedScore(rating, opponent)
  const delta = Math.round(k * (actual - exp))
  return { rating: Math.max(100, rating + delta), delta }
}
