export function calculateUserLevel(totalScore: number): number {
  if (totalScore <= 0) return 1;
  return Math.floor(Math.sqrt(totalScore / 500)) + 1;
}

export function generateDefaultAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}
