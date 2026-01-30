import type { Database } from "sql.js";
import type { Epic, Story, StoryComment } from "@inbox/types";

export type InboxPreferences = {
  showArchived?: boolean;
  listPaneWidth?: number;
  epicsPaneWidth?: number;
  epicsPaneCollapsed?: boolean;
  typeOfWorkOptions?: string[];
};

export type InboxState = {
  epics: Epic[];
  stories: Story[];
  preferences: InboxPreferences;
};

const getJson = (db: Database, key: string) => {
  const stmt = db.prepare("SELECT value FROM user_config WHERE key = ?");
  stmt.bind([key]);
  const value = stmt.step() ? (stmt.get()[0] as string) : null;
  stmt.free();
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Failed to parse user_config key "${key}":`, error);
    return null;
  }
};

const setJson = (db: Database, key: string, value: unknown) => {
  const stmt = db.prepare(
    "INSERT INTO user_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  );
  stmt.run([key, JSON.stringify(value)]);
  stmt.free();
};

const parseStoryCodeNumber = (value?: string) => {
  if (!value) return null;
  const match = /^ST-(\d+)$/.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatStoryCode = (value: number) => `ST-${String(value).padStart(3, "0")}`;

const toDate = (value: unknown, fallback = new Date()) => {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
  return fallback;
};

const serializeEpic = (epic: Epic) => ({
  ...epic,
  createdAt: epic.createdAt.toISOString(),
});

const deserializeEpic = (raw: Partial<Epic>): Epic => ({
  id: raw.id || "",
  key: raw.key || "",
  name: raw.name || "Untitled",
  description: raw.description || "",
  color: raw.color || "hsl(217, 91%, 60%)",
  isStarred: Boolean(raw.isStarred),
  isArchived: Boolean(raw.isArchived),
  createdAt: toDate(raw.createdAt),
});

const serializeStory = (story: Story) => ({
  ...story,
  storyCode: story.storyCode,
  startDate: story.startDate ? story.startDate.toISOString() : undefined,
  dueDates: story.dueDates.map((date) => date.toISOString()),
  createdAt: story.createdAt.toISOString(),
  isYearly: story.isYearly,
  deletedAt: story.deletedAt ? story.deletedAt.toISOString() : undefined,
  completedAt: story.completedAt ? story.completedAt.toISOString() : undefined,
  comments: story.comments?.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    meetingDate: comment.meetingDate,
    isCompleted: comment.isCompleted,
  })),
  attachments: story.attachments?.map((file) => ({
    id: file.id,
    name: file.name,
    path: file.path,
  })),
});

const deserializeStory = (raw: Partial<Story>): Story => {
  const rawDueDates = Array.isArray(raw.dueDates) ? raw.dueDates : null;
  // If isYearly flag was missing in older saves, infer from empty due dates plus a start date.
  const inferredYearly =
    raw.isYearly ??
    (rawDueDates && rawDueDates.length === 0 && Boolean(raw.startDate));
  return {
    id: raw.id || "",
    storyCode: raw.storyCode,
    key: raw.key || "",
    title: raw.title || "Untitled story",
    description: raw.description || "",
    epicId: raw.epicId || "",
    typeOfWork: raw.typeOfWork || "",
    startDate: raw.startDate ? toDate(raw.startDate) : undefined,
    dueDates: rawDueDates
      ? rawDueDates.map((date) => toDate(date))
      : [toDate(raw.createdAt)],
    assignee: raw.assignee,
    status: raw.status || "New",
    priority: (raw.priority as Story["priority"]) || "medium",
    createdAt: toDate(raw.createdAt),
    discussed: Boolean(raw.discussed),
    isYearly: Boolean(inferredYearly),
    isDeleted: Boolean(raw.isDeleted),
    deletedAt: raw.deletedAt ? toDate(raw.deletedAt) : undefined,
    completedAt: raw.completedAt ? toDate(raw.completedAt) : undefined,
    comments: Array.isArray(raw.comments)
      ? raw.comments.map((comment: Partial<StoryComment>) => ({
          id: comment.id || "",
          text: comment.text || "",
          createdAt: toDate(comment.createdAt),
          meetingDate: typeof comment.meetingDate === "number" ? comment.meetingDate : undefined,
          isCompleted: Boolean(comment.isCompleted),
        }))
      : [],
    attachments: Array.isArray((raw as Story).attachments)
      ? (raw as Story).attachments!.map((file) => ({
          id: file.id || crypto.randomUUID(),
          name: file.name || "file",
          path: file.path || "",
        }))
      : [],
  };
};

export const loadInboxState = (db: Database): InboxState => {
  const stored = getJson(db, "inbox_state");
  if (!stored) {
    return { epics: [], stories: [], preferences: {} };
  }
  const rawEpics = Array.isArray(stored.epics) ? stored.epics : [];
  const rawStories = Array.isArray(stored.stories) ? stored.stories : [];
  const epics = rawEpics.map((epic) => deserializeEpic(epic));
  let didInferYearly = false;
  const stories = rawStories.map((story) => {
    const deserialized = deserializeStory(story);
    if (!story.isYearly && deserialized.isYearly) {
      didInferYearly = true;
    }
    return deserialized;
  });
  const cutoff = Date.now() - 10 * 24 * 60 * 60 * 1000;
  let prunedStories = stories.filter((story) => {
    if (!story.isDeleted) return true;
    if (!story.deletedAt) return true;
    return story.deletedAt.getTime() >= cutoff;
  });
  const existingMax = prunedStories.reduce((max, story) => {
    const value = parseStoryCodeNumber(story.storyCode);
    return value && value > max ? value : max;
  }, 0);
  let nextCode = existingMax + 1;
  let didAssignStoryCodes = false;
  prunedStories = prunedStories.map((story) => {
    if (story.storyCode) return story;
    didAssignStoryCodes = true;
    const storyCode = formatStoryCode(nextCode);
    nextCode += 1;
    return { ...story, storyCode };
  });
  if (prunedStories.length !== stories.length || didInferYearly) {
    setJson(db, "inbox_state", {
      epics: epics.map((epic) => serializeEpic(epic)),
      stories: prunedStories.map((story) => serializeStory(story)),
      preferences: stored.preferences ?? {},
    });
  } else if (didAssignStoryCodes) {
    setJson(db, "inbox_state", {
      epics: epics.map((epic) => serializeEpic(epic)),
      stories: prunedStories.map((story) => serializeStory(story)),
      preferences: stored.preferences ?? {},
    });
  }
  return {
    epics,
    stories: prunedStories,
    preferences: stored.preferences ?? {},
  };
};

export const saveInboxState = (db: Database, state: InboxState) => {
  setJson(db, "inbox_state", {
    epics: state.epics.map((epic) => serializeEpic(epic)),
    stories: state.stories.map((story) => serializeStory(story)),
    preferences: state.preferences,
  });
};
