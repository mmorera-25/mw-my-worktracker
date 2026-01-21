import type { Database } from "sql.js";
import type { Epic, Story, StoryComment } from "@inbox/types";

export type InboxPreferences = {
  showArchived?: boolean;
  listPaneWidth?: number;
  calendarRightWidth?: number;
  epicsPaneWidth?: number;
  epicsPaneCollapsed?: boolean;
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
  return value ? JSON.parse(value) : null;
};

const setJson = (db: Database, key: string, value: unknown) => {
  const stmt = db.prepare(
    "INSERT INTO user_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  );
  stmt.run([key, JSON.stringify(value)]);
  stmt.free();
};

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
  dueDates: story.dueDates.map((date) => date.toISOString()),
  createdAt: story.createdAt.toISOString(),
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

const deserializeStory = (raw: Partial<Story>): Story => ({
  id: raw.id || "",
  key: raw.key || "",
  title: raw.title || "Untitled story",
  description: raw.description || "",
  epicId: raw.epicId || "",
  dueDates: Array.isArray(raw.dueDates) && raw.dueDates.length > 0
    ? raw.dueDates.map((date) => toDate(date))
    : [toDate(raw.createdAt)],
  assignee: raw.assignee,
  status: raw.status || "Backlog",
  priority: (raw.priority as Story["priority"]) || "medium",
  createdAt: toDate(raw.createdAt),
  discussed: Boolean(raw.discussed),
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
});

export const loadInboxState = (db: Database): InboxState => {
  const stored = getJson(db, "inbox_state");
  if (!stored) {
    return { epics: [], stories: [], preferences: {} };
  }
  const rawEpics = Array.isArray(stored.epics) ? stored.epics : [];
  const rawStories = Array.isArray(stored.stories) ? stored.stories : [];
  return {
    epics: rawEpics.map((epic) => deserializeEpic(epic)),
    stories: rawStories.map((story) => deserializeStory(story)),
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
