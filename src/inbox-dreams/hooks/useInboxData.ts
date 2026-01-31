import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Epic, Story } from "@inbox/types";
import { loadDb, persistDb } from "../../lib/storage/dbManager";
import { loadInboxState } from "@inbox/data/inboxRepository";
import { normalizeKanbanBuckets, type KanbanBucket } from "../../lib/settings/configRepository";

export const NO_EPIC_ID = "no-epic-assigned";
export const NO_EPIC_NAME = "No Epic Assigned";
export const NO_EPIC_KEY = "NOEPIC";
export const DOC_EPIC_ID = "documentation-epic";
export const DOC_EPIC_NAME = "Documentation";
export const DOC_EPIC_LEGACY_NAME = "Documentation Epic";
export const DOC_EPIC_KEY = "DOC";

const DEFAULT_WORKFLOW_COLUMNS = [
  "Backlog",
  "Scheduled",
  "On Hold / Waiting",
  "New",
  "To Ask",
  "To Do",
  "Done",
] as const;

const isSystemEpic = (epic: Epic) =>
  epic.id === NO_EPIC_ID ||
  epic.name === NO_EPIC_NAME ||
  epic.id === DOC_EPIC_ID ||
  epic.name === DOC_EPIC_NAME ||
  epic.name === DOC_EPIC_LEGACY_NAME;

const ensureNoEpicAssigned = (epics: Epic[], stories: Story[]) => {
  const epicIds = new Set(epics.map((epic) => epic.id));
  const archivedEpicIds = new Set(epics.filter((epic) => epic.isArchived).map((epic) => epic.id));
  const isMissingEpic = (story: Story) => {
    const trimmed = story.epicId?.trim?.() ?? "";
    if (!trimmed) return true;
    if (trimmed === DOC_EPIC_ID) return false;
    if (archivedEpicIds.has(trimmed)) return true;
    if (!epicIds.has(trimmed)) return true;
    const lower = trimmed.toLowerCase();
    if (["no epic", "none", "backlog", "unassigned"].includes(lower)) return true;
    return false;
  };

  let noEpic = epics.find((epic) => epic.id === NO_EPIC_ID) ?? epics.find((epic) => epic.name === NO_EPIC_NAME);
  let nextEpics = epics;

  if (!noEpic) {
    noEpic = {
      id: NO_EPIC_ID,
      key: NO_EPIC_KEY,
      name: NO_EPIC_NAME,
      description: "System list for stories missing an epic.",
      color: "hsl(215, 16%, 47%)",
      isStarred: false,
      isArchived: false,
      createdAt: new Date(),
    };
    nextEpics = [...epics, noEpic];
  } else if (noEpic.isArchived) {
    nextEpics = epics.map((epic) => (epic.id === noEpic!.id ? { ...epic, isArchived: false } : epic));
  }

  let docEpic =
    nextEpics.find((epic) => epic.id === DOC_EPIC_ID) ??
    nextEpics.find((epic) => epic.name === DOC_EPIC_NAME || epic.name === DOC_EPIC_LEGACY_NAME);
  if (!docEpic) {
    docEpic = {
      id: DOC_EPIC_ID,
      key: DOC_EPIC_KEY,
      name: DOC_EPIC_NAME,
      description: "System epic for product and workflow documentation.",
      color: "hsl(200, 12%, 45%)",
      isStarred: false,
      isArchived: false,
      createdAt: new Date(),
    };
    nextEpics = [...nextEpics, docEpic];
  } else if (docEpic.isArchived || docEpic.name !== DOC_EPIC_NAME) {
    nextEpics = nextEpics.map((epic) => (epic.id === docEpic!.id ? { ...epic, name: DOC_EPIC_NAME, isArchived: false } : epic));
  }

  const fallbackEpicId = noEpic.id;
  let didUpdateStory = false;
  const nextStories = stories.map((story) => {
    if (isMissingEpic(story)) {
      didUpdateStory = true;
      return { ...story, epicId: fallbackEpicId };
    }
    return story;
  });

  return {
    epics: nextEpics,
    stories: didUpdateStory ? nextStories : stories,
  };
};

const parseStoryCodeNumber = (value?: string) => {
  if (!value) return null;
  const match = /^ST-(\d+)$/.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatStoryCode = (value: number) => `ST-${String(value).padStart(3, "0")}`;

const getNextStoryCode = (stories: Story[]) => {
  const max = stories.reduce((current, story) => {
    const value = parseStoryCodeNumber(story.storyCode);
    return value && value > current ? value : current;
  }, 0);
  return formatStoryCode(max + 1);
};

type UseInboxDataOptions = {
  doneStatus: string;
  defaultStatus: string;
  kanbanBuckets: Record<string, KanbanBucket>;
};

export function useInboxData({ doneStatus, defaultStatus, kanbanBuckets }: UseInboxDataOptions) {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [requiresStorageSetup, setRequiresStorageSetup] = useState(false);
  const isHydratedRef = useRef(false);

  const getStoryEpicBucketId = useCallback(
    (story: Story) => {
      const trimmed = story.epicId?.trim?.() ?? "";
      if (!trimmed) return NO_EPIC_ID;
      const lower = trimmed.toLowerCase();
      if (
        lower === NO_EPIC_ID ||
        lower === NO_EPIC_NAME.toLowerCase() ||
        lower === NO_EPIC_KEY.toLowerCase() ||
        ["no epic", "no epic assigned", "none", "backlog", "unassigned"].includes(lower)
      ) {
        return NO_EPIC_ID;
      }
      const epicById = epics.find((epic) => epic.id === trimmed);
      if (epicById) return epicById.isArchived ? NO_EPIC_ID : epicById.id;
      const epicByAlias = epics.find((epic) => epic.name.toLowerCase() === lower || epic.key.toLowerCase() === lower);
      if (epicByAlias) return epicByAlias.isArchived ? NO_EPIC_ID : epicByAlias.id;
      return NO_EPIC_ID;
    },
    [epics]
  );

  useEffect(() => {
    const init = async () => {
      const ctx = await loadDb();
      setRequiresStorageSetup(ctx.mode !== "fs");
      const inboxState = loadInboxState(ctx.db);
      const normalized = ensureNoEpicAssigned(inboxState.epics, inboxState.stories);
      const statusNormalized = normalized.stories.map((story) =>
        story.status === "Doing" ? { ...story, status: "To Do" } : story
      );
      setEpics(normalized.epics);
      setStories(statusNormalized);
      await persistDb(ctx);
      isHydratedRef.current = true;
    };
    init();
  }, []);

  // External refresh helper (for events)
  const reloadInbox = useCallback(async () => {
    const ctx = await loadDb();
    setRequiresStorageSetup(ctx.mode !== "fs");
    const inboxState = loadInboxState(ctx.db);
    const normalized = ensureNoEpicAssigned(inboxState.epics, inboxState.stories);
    const statusNormalized = normalized.stories.map((story) =>
      story.status === "Doing" ? { ...story, status: "To Do" } : story
    );
    setEpics(normalized.epics);
    setStories(statusNormalized);
    await persistDb(ctx);
  }, []);

  const handleCreateEpic = useCallback((epicData: Omit<Epic, "id" | "createdAt">) => {
    const newEpic: Epic = { ...epicData, id: String(Date.now()), createdAt: new Date() };
    setEpics((prev) => [...prev, newEpic]);
    setSelectedEpicId(newEpic.id);
  }, []);

  const handleArchiveEpic = useCallback(
    (epicId: string) => {
      const epic = epics.find((entry) => entry.id === epicId);
      if (!epic || isSystemEpic(epic)) return;
      setEpics((prev) => prev.map((entry) => (entry.id === epicId ? { ...entry, isArchived: true } : entry)));
      if (selectedEpicId === epicId) setSelectedEpicId(null);
    },
    [epics, selectedEpicId]
  );

  const handleDeleteEpic = useCallback(
    (epicId: string) => {
      const epic = epics.find((entry) => entry.id === epicId);
      if (!epic || isSystemEpic(epic)) return;
      const hasAssignedStories = stories.some((story) => story.epicId === epicId && !story.isDeleted);
      if (hasAssignedStories) {
        window.alert("This epic still has stories. Reassign them to another epic before deleting.");
        return;
      }
      setEpics((prev) => prev.filter((entry) => entry.id !== epicId));
      if (selectedEpicId === epicId) setSelectedEpicId(null);
    },
    [epics, stories, selectedEpicId]
  );

  const handleRestoreEpic = useCallback((epicId: string) => {
    setEpics((prev) => prev.map((epic) => (epic.id === epicId ? { ...epic, isArchived: false } : epic)));
  }, []);

  const handleUpdateEpicColor = useCallback((epicId: string, color: string) => {
    setEpics((prev) => prev.map((epic) => (epic.id === epicId ? { ...epic, color } : epic)));
  }, []);

  const handleUpdateEpicField = useCallback(
    (epicId: string, field: "name" | "key" | "description", value: string) => {
      setEpics((prev) =>
        prev.map((epic) => {
          if (epic.id !== epicId) return epic;
          if (field === "name") return { ...epic, name: value.trim() || epic.name };
          if (field === "key") {
            const nextKey = value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
            return nextKey ? { ...epic, key: nextKey } : epic;
          }
          return { ...epic, description: value.trim() };
        })
      );
    },
    []
  );

  const handleCreateStory = useCallback(
    (storyData: Omit<Story, "id" | "key" | "createdAt">) => {
      const epic = epics.find((e) => e.id === storyData.epicId);
      const epicStoryCount = stories.filter((s) => s.epicId === storyData.epicId).length;
      const normalizedDueDates = (storyData.dueDates ?? [])
        .map((date) => (date instanceof Date ? date : new Date(date)))
        .filter((date) => !Number.isNaN(date.getTime()));
      const storyCode = getNextStoryCode(stories);
      const fallbackDueDates = storyData.isYearly ? [] : [new Date()];
      const dueDates = normalizedDueDates.length > 0 ? normalizedDueDates : fallbackDueDates;
      const newStory: Story = {
        ...storyData,
        id: String(Date.now()),
        storyCode,
        key: `${epic?.key || "TASK"}-${epicStoryCount + 100}`,
        createdAt: new Date(),
        dueDates,
        isYearly: Boolean(storyData.isYearly),
      };
      setStories((prev) => [...prev, newStory]);
      setSelectedStoryId(newStory.id);
    },
    [epics, stories]
  );

  const handleUpdateStory = useCallback(
    (updatedStory: Story) => {
      const epicMatch = epics.find((entry) => entry.id === updatedStory.epicId);
      const isDocEpic =
        updatedStory.epicId === DOC_EPIC_ID ||
        epicMatch?.name === DOC_EPIC_NAME ||
        epicMatch?.name === DOC_EPIC_LEGACY_NAME;
      const normalizedDueDates = (updatedStory.dueDates ?? [])
        .map((date) => (date instanceof Date ? date : new Date(date)))
        .filter((date) => !Number.isNaN(date.getTime()));
      const normalizedStatus = updatedStory.status === "Doing" ? "To Do" : updatedStory.status;
      const normalizedStory: Story = {
        ...updatedStory,
        status: normalizedStatus,
        dueDates: normalizedDueDates,
      };
      const isCompletedStatus = isDocEpic ? updatedStory.status === "Saved" : updatedStory.status === doneStatus;
      if (isCompletedStatus && !updatedStory.completedAt) {
        normalizedStory.completedAt = new Date();
      }
      if (!isCompletedStatus) {
        normalizedStory.completedAt = undefined;
      }
      setStories((prev) => prev.map((s) => (s.id === normalizedStory.id ? normalizedStory : s)));
    },
    [doneStatus, epics]
  );

  const handleMoveStoryToBucket = useCallback(
    (storyId: string, targetBucket: KanbanBucket) => {
      const story = stories.find((s) => s.id === storyId);
      if (!story) return;
      const bucketStatuses = Object.entries(kanbanBuckets)
        .filter(([, bucket]) => bucket === targetBucket)
        .map(([status]) => status);
      const nextStatus = bucketStatuses[0] ?? (targetBucket === "completed" ? doneStatus : defaultStatus);
      handleUpdateStory({ ...story, status: nextStatus });
    },
    [stories, kanbanBuckets, doneStatus, defaultStatus, handleUpdateStory]
  );

  const handleDeleteStory = useCallback(
    (storyId: string) => {
      const target = stories.find((story) => story.id === storyId);
      if (target && !window.confirm(`Delete "${target.title}"?`)) {
        return;
      }
      setStories((prev) => prev.map((s) => (s.id === storyId ? { ...s, isDeleted: true, deletedAt: new Date() } : s)));
      if (selectedStoryId === storyId) setSelectedStoryId(null);
    },
    [stories, selectedStoryId]
  );

  const handleRestoreStory = useCallback((storyId: string) => {
    setStories((prev) => prev.map((s) => (s.id === storyId ? { ...s, isDeleted: false, deletedAt: undefined } : s)));
  }, []);

  const handlePermanentDelete = useCallback(
    (storyId: string) => {
      const target = stories.find((story) => story.id === storyId);
      if (target && !window.confirm(`Permanently delete "${target.title}"?`)) {
        return;
      }
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      if (selectedStoryId === storyId) setSelectedStoryId(null);
    },
    [stories, selectedStoryId]
  );

  const handleEmptyTrash = useCallback(() => {
    setStories((prev) => {
      const selectedIsDeleted = selectedStoryId ? prev.find((s) => s.id === selectedStoryId)?.isDeleted : false;
      if (selectedIsDeleted) setSelectedStoryId(null);
      return prev.filter((s) => !s.isDeleted);
    });
  }, [selectedStoryId]);

  const normalizedStories = useMemo(() => {
    let didNormalize = false;
    const next = stories.map((story) => {
      const normalizedEpicId = getStoryEpicBucketId(story);
      const normalizedStatus = story.status === "Doing" ? "To Do" : story.status;
      if (normalizedEpicId === story.epicId && normalizedStatus === story.status) return story;
      didNormalize = true;
      return { ...story, epicId: normalizedEpicId, status: normalizedStatus };
    });
    return didNormalize ? next : stories;
  }, [stories, getStoryEpicBucketId]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    const didNormalize = normalizedStories !== stories;
    if (didNormalize) setStories(normalizedStories);
  }, [normalizedStories, stories]);

  const activeEpics = useMemo(() => epics.filter((epic) => !epic.isArchived), [epics]);
  const archivedEpics = useMemo(() => epics.filter((epic) => epic.isArchived), [epics]);
  const yearlyStories = useMemo(() => normalizedStories.filter((story) => story.isYearly), [normalizedStories]);
  const regularStories = useMemo(() => normalizedStories.filter((story) => !story.isYearly), [normalizedStories]);
  const selectedStory = useMemo(() => normalizedStories.find((s) => s.id === selectedStoryId), [normalizedStories, selectedStoryId]);

  return {
    epics,
    stories: normalizedStories,
    setEpics,
    setStories,
    selectedEpicId,
    setSelectedEpicId,
    selectedStoryId,
    setSelectedStoryId,
    activeEpics,
    archivedEpics,
    yearlyStories,
    regularStories,
    selectedStory,
    requiresStorageSetup,
    reloadInbox,
    getStoryEpicBucketId,
    handleCreateEpic,
    handleArchiveEpic,
    handleDeleteEpic,
    handleRestoreEpic,
    handleUpdateEpicColor,
    handleUpdateEpicField,
    handleCreateStory,
    handleUpdateStory,
    handleMoveStoryToBucket,
    handleDeleteStory,
    handleRestoreStory,
    handlePermanentDelete,
    handleEmptyTrash,
    isSystemEpic,
  };
}

export default useInboxData;
