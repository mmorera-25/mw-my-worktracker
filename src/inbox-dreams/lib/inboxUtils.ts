import type { Story } from "@inbox/types";

export const getEffectiveDueDate = (story: Story) => {
  const dates =
    story.dueDates && story.dueDates.length > 0
      ? story.dueDates.filter((date) => !Number.isNaN(date.getTime?.()))
      : [story.createdAt];
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const upcoming = sorted.find((date) => date >= now);
  return upcoming ?? sorted[sorted.length - 1];
};

export const getAllDueDates = (story: Story) => {
  const dates =
    story.dueDates && story.dueDates.length > 0
      ? story.dueDates.filter((date) => !Number.isNaN(date.getTime?.()))
      : [];
  return dates.length > 0 ? dates : [story.createdAt];
};

const parseStoryCodeNumber = (value?: string) => {
  if (!value) return null;
  const match = /^ST-(\d+)$/.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatStoryCode = (value: number) => `ST-${String(value).padStart(3, "0")}`;

export const getNextStoryCode = (stories: Story[]) => {
  const max = stories.reduce((current, story) => {
    const value = parseStoryCodeNumber(story.storyCode);
    return value && value > current ? value : current;
  }, 0);
  return formatStoryCode(max + 1);
};
