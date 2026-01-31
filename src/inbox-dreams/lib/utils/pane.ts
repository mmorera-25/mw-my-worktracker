export const clampPaneWidth = (value: number, min = 180, max = 320) => {
  return Math.min(max, Math.max(min, value));
};
