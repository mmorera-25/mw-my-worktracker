import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { IconSidebar } from "@inbox/components/IconSidebar";
import { ListSidebar } from "@inbox/components/ListSidebar";
import { StoryList } from "@inbox/components/StoryList";
import { StoryDetail } from "@inbox/components/StoryDetail";
import StoryKanban from "@inbox/components/StoryKanban";
import { EmptyState } from "@inbox/components/EmptyState";
import { CreateEpicDialog } from "@inbox/components/CreateEpicDialog";
import { Dialog, DialogContent } from "@inbox/components/ui/dialog";
import type { Epic, Story } from "@inbox/types";
import DataStoragePanel from "../features/settings/DataStoragePanel";
import MeetingNotes from "../features/notes/MeetingNotes";
import OKRPage from "../features/okrs/OKRPage";
import OneOnOneFeed from "../features/oneonone/OneOnOneFeed";
import ReportingView from "../features/reporting/ReportingView";
import { loadDb, persistDb, type DbContext } from "../lib/storage/dbManager";
import {
  loadWorkflowConfig,
  saveWorkflowConfig,
  normalizeKanbanBuckets,
  type WorkflowConfig,
  type KanbanBucket,
} from "../lib/settings/configRepository";
import { setAccentColor } from "../theme/applyTheme";
import { loadInboxState, saveInboxState } from "@inbox/data/inboxRepository";
import { addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { Archive, ArrowLeft, Inbox, Trash2, RotateCcw } from "lucide-react";

type InboxDreamsShellProps = {
  user: FirebaseUser;
};

const NO_EPIC_ID = "no-epic-assigned";
const NO_EPIC_NAME = "No Epic Assigned";
const NO_EPIC_KEY = "NOEPIC";
const DOC_EPIC_ID = "documentation-epic";
const DOC_EPIC_NAME = "Documentation";
const DOC_EPIC_LEGACY_NAME = "Documentation Epic";
const DOC_EPIC_KEY = "DOC";
const INBOX_LIST_WIDTH = 420;
const EPICS_BAR_WIDTH = 24;
const EPICS_RESIZER_WIDTH = 4;
const EPICS_SEPARATOR_WIDTH = 1;
const DEFAULT_WORKFLOW_COLUMNS = [
  "Backlog",
  "Scheduled",
  "On Hold / Waiting",
  "New",
  "To Ask",
  "To Do",
  "Done",
] as const;
const LIST_MIN_WIDTH = 320;
const LIST_MAX_RATIO = 0.7;
const isSystemEpic = (epic: Epic) =>
  epic.id === NO_EPIC_ID ||
  epic.name === NO_EPIC_NAME ||
  epic.id === DOC_EPIC_ID ||
  epic.name === DOC_EPIC_NAME ||
  epic.name === DOC_EPIC_LEGACY_NAME;

const ensureNoEpicAssigned = (epics: Epic[], stories: Story[]) => {
  const epicIds = new Set(epics.map((epic) => epic.id));
  const archivedEpicIds = new Set(
    epics.filter((epic) => epic.isArchived).map((epic) => epic.id)
  );
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
  let noEpic =
    epics.find((epic) => epic.id === NO_EPIC_ID) ??
    epics.find((epic) => epic.name === NO_EPIC_NAME);
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
    nextEpics = epics.map((epic) =>
      epic.id === noEpic.id ? { ...epic, isArchived: false } : epic
    );
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
    nextEpics = nextEpics.map((epic) => {
      if (epic.id !== docEpic!.id) return epic;
      return {
        ...epic,
        name: DOC_EPIC_NAME,
        isArchived: false,
      };
    });
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

const getEffectiveDueDate = (story: Story) => {
  const dates =
    story.dueDates && story.dueDates.length > 0
      ? story.dueDates.filter((date) => !Number.isNaN(date.getTime?.()))
      : [story.createdAt];
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const upcoming = sorted.find((date) => date >= now);
  return upcoming ?? sorted[sorted.length - 1];
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

const getAllDueDates = (story: Story) => {
  const dates =
    story.dueDates && story.dueDates.length > 0
      ? story.dueDates.filter((date) => !Number.isNaN(date.getTime?.()))
      : [];
  return dates.length > 0 ? dates : [story.createdAt];
};

const clampPaneWidth = (value: number, min = 180, max = 320) => {
  return Math.min(max, Math.max(min, value));
};

const InboxDreamsShell = ({ user }: InboxDreamsShellProps) => {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState("week");
  const [isCreateEpicOpen, setIsCreateEpicOpen] = useState(false);
  const [isEditEpicOpen, setIsEditEpicOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
  const [modalActiveView, setModalActiveView] = useState("week");
  const [isModalEpicsPaneCollapsed, setIsModalEpicsPaneCollapsed] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [focusedOkr, setFocusedOkr] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowConfig>({
    columns: [...DEFAULT_WORKFLOW_COLUMNS],
    swimlanes: ["Core", "Enablement", "Bugs"],
    accent: "indigo",
    kanbanStatusBuckets: normalizeKanbanBuckets([...DEFAULT_WORKFLOW_COLUMNS], null),
  });
  const [editingField, setEditingField] = useState<{
    id: string;
    field: "name" | "key" | "description";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);
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
      const epicByAlias = epics.find(
        (epic) =>
          epic.name.toLowerCase() === lower || epic.key.toLowerCase() === lower
      );
      if (epicByAlias) return epicByAlias.isArchived ? NO_EPIC_ID : epicByAlias.id;
      return NO_EPIC_ID;
    },
    [epics]
  );
  const [listPaneWidth, setListPaneWidth] = useState(INBOX_LIST_WIDTH);
  const [isResizingListPane, setIsResizingListPane] = useState(false);
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "next-week">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeOfWorkFilters, setTypeOfWorkFilters] = useState<string[]>([]);
  const statusFiltersInitialized = useRef(false);
  const typeFiltersInitialized = useRef(false);
  const [epicsPaneWidth, setEpicsPaneWidth] = useState(208);
  const [isResizingEpicsPane, setIsResizingEpicsPane] = useState(false);
  const [isEpicsPaneCollapsed, setIsEpicsPaneCollapsed] = useState(false);
  const [detailContainerWidth, setDetailContainerWidth] = useState(0);
  const detailContainerRef = useRef<HTMLDivElement | null>(null);
  const dbContextRef = useRef<DbContext | null>(null);
  const [requiresStorageSetup, setRequiresStorageSetup] = useState(false);
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState<string[]>([
    "Configuration",
    "Ask question in a Meeting",
    "Document",
    "Send Email",
    "Aligment Required",
    "Waiting for Answer",
  ]);
  const persistTypeOfWorkOptions = useCallback(async (next: string[]) => {
    setTypeOfWorkOptions(next);
    const ctx = await loadDb();
    const inboxState = loadInboxState(ctx.db);
    saveInboxState(ctx.db, {
      epics: inboxState.epics,
      stories: inboxState.stories,
      preferences: {
        ...inboxState.preferences,
        typeOfWorkOptions: next,
      },
    });
    await persistDb(ctx);
    window.dispatchEvent(new Event("inbox-stories-updated"));
  }, []);

  const firstName = useMemo(() => {
    if (user.displayName) {
      return user.displayName.trim().split(" ")[0];
    }
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "Account";
  }, [user.displayName, user.email]);
  const isInboxView = useMemo(
    () =>
      [
        "todo",
        "week",
        "kanban",
        "yearly",
        "inbox",
        "search",
        "grid",
        "trash",
        "epics",
      ].includes(activeView),
    [activeView]
  );
  const doneStatus = useMemo(() => {
    if (workflow.columns.length > 0) {
      return workflow.columns[workflow.columns.length - 1];
    }
    return "Done";
  }, [workflow.columns]);
  const defaultStatus = useMemo(() => {
    if (workflow.columns.includes("New")) return "New";
    return workflow.columns[0] ?? "Backlog";
  }, [workflow.columns]);
  const statusOptions = useMemo(
    () => workflow.columns.filter((column) => column !== "Doing"),
    [workflow.columns]
  );
  const kanbanBuckets = useMemo(
    () => normalizeKanbanBuckets(workflow.columns, workflow.kanbanStatusBuckets),
    [workflow.columns, workflow.kanbanStatusBuckets]
  );
  const isDocumentationStory = useCallback(
    (story: Story) => {
      const epic = epics.find((entry) => entry.id === story.epicId);
      return (
        story.epicId === DOC_EPIC_ID ||
        epic?.name === DOC_EPIC_NAME ||
        epic?.name === DOC_EPIC_LEGACY_NAME
      );
    },
    [epics]
  );
  const isStoryDone = useCallback(
    (story: Story) =>
      isDocumentationStory(story) ? story.status === "Saved" : story.status === doneStatus,
    [doneStatus, isDocumentationStory]
  );

  useEffect(() => {
    const initConfig = async () => {
      const ctx = await loadDb();
      dbContextRef.current = ctx;
      setRequiresStorageSetup(ctx.mode !== "fs");
      const cfg = loadWorkflowConfig(ctx.db);
      setWorkflow(cfg);
      if (cfg.accent === "teal") setAccentColor("#14B8A6");
      const inboxState = loadInboxState(ctx.db);
      const normalized = ensureNoEpicAssigned(inboxState.epics, inboxState.stories);
      setEpics(normalized.epics);
      setStories(normalized.stories);
      setShowArchived(Boolean(inboxState.preferences.showArchived));
      if (Array.isArray(inboxState.preferences.typeOfWorkOptions)) {
        setTypeOfWorkOptions(inboxState.preferences.typeOfWorkOptions);
      }
      setListPaneWidth(inboxState.preferences.listPaneWidth ?? INBOX_LIST_WIDTH);
      setEpicsPaneWidth(clampPaneWidth(inboxState.preferences.epicsPaneWidth ?? 208));
      setIsEpicsPaneCollapsed(Boolean(inboxState.preferences.epicsPaneCollapsed));
      await persistDb(ctx);
      setIsHydrated(true);
    };
    initConfig();
  }, []);

  const normalizedStories = useMemo(() => {
    let didNormalize = false;
    const next = stories.map((story) => {
      const normalizedEpicId = getStoryEpicBucketId(story);
      const normalizedStatus = story.status === "Doing" ? "To Do" : story.status;
      if (normalizedEpicId === story.epicId && normalizedStatus === story.status) {
        return story;
      }
      didNormalize = true;
      return { ...story, epicId: normalizedEpicId, status: normalizedStatus };
    });
    return didNormalize ? next : stories;
  }, [stories, getStoryEpicBucketId]);

  const statusUsageCounts = useMemo(() => {
    return normalizedStories
      .filter((story) => !story.isDeleted)
      .reduce<Record<string, number>>((acc, story) => {
        acc[story.status] = (acc[story.status] ?? 0) + 1;
        return acc;
      }, {});
  }, [normalizedStories]);

  const allStatusOptions = useMemo(() => {
    const options = statusOptions.filter((status) => status !== "Saved");
    const hasSaved = normalizedStories.some((story) => story.status === "Saved");
    const merged = hasSaved ? [...options, "Saved"] : options;
    return Array.from(new Set(merged));
  }, [normalizedStories, statusOptions]);

  const allStatusFilterOptions = useMemo(() => {
    const storyStatuses = normalizedStories.map((story) => story.status).filter(Boolean);
    return Array.from(new Set([...allStatusOptions, ...storyStatuses]));
  }, [allStatusOptions, normalizedStories]);

  const allTypeFilterOptions = useMemo(() => {
    const storyTypes = normalizedStories
      .map((story) => story.typeOfWork?.trim())
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...typeOfWorkOptions, ...storyTypes, "__unassigned__"]));
  }, [typeOfWorkOptions, normalizedStories]);

  useEffect(() => {
    if (statusFiltersInitialized.current) return;
    const defaultFilters = allStatusOptions.filter(
      (status) =>
        status !== doneStatus &&
        status !== "Saved" &&
        status !== "Backlog"
    );
    setStatusFilters(defaultFilters);
    statusFiltersInitialized.current = true;
  }, [allStatusOptions, doneStatus]);

  useEffect(() => {
    if (typeFiltersInitialized.current) return;
    setTypeOfWorkFilters([...typeOfWorkOptions, "__unassigned__"]);
    typeFiltersInitialized.current = true;
  }, [typeOfWorkOptions]);

  const typeUsageCounts = useMemo(() => {
    return normalizedStories
      .filter((story) => !story.isDeleted)
      .reduce<Record<string, number>>((acc, story) => {
        const key = story.typeOfWork?.trim();
        if (!key) return acc;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
  }, [normalizedStories]);

  const yearlyStories = useMemo(
    () => normalizedStories.filter((story) => story.isYearly),
    [normalizedStories]
  );
  const regularStories = useMemo(
    () => normalizedStories.filter((story) => !story.isYearly),
    [normalizedStories]
  );

  const selectedStory = normalizedStories.find((s) => s.id === selectedStoryId);
  const epicsPaneTotalWidth = useMemo(() => {
    if (isEpicsPaneCollapsed) return EPICS_BAR_WIDTH;
    return (
      clampPaneWidth(epicsPaneWidth) +
      EPICS_RESIZER_WIDTH +
      EPICS_SEPARATOR_WIDTH
    );
  }, [isEpicsPaneCollapsed, epicsPaneWidth]);
  const effectiveListWidth = useMemo(() => {
    if (!detailContainerWidth) return listPaneWidth;
    const available = detailContainerWidth - epicsPaneTotalWidth;
    const maxWidth = Math.max(0, available * LIST_MAX_RATIO);
    const clamped = Math.min(maxWidth, Math.max(LIST_MIN_WIDTH, listPaneWidth));
    return Number.isNaN(clamped) ? listPaneWidth : clamped;
  }, [detailContainerWidth, epicsPaneTotalWidth, listPaneWidth]);
  const modalListWidth = Math.min(listPaneWidth, 520);

  const buildFilteredStories = useCallback(
    (view: string) => {
      let result =
        view === "yearly"
          ? yearlyStories
          : view === "trash"
          ? normalizedStories
          : regularStories;

      if (view === "trash") {
        result = result.filter((s) => s.isDeleted);
      } else {
        result = result.filter((s) => !s.isDeleted);
      }

      if (selectedEpicId && !["completed", "trash"].includes(view)) {
        result = result.filter((s) => s.epicId === selectedEpicId);
      }
      if (view === "search" && searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        result = result.filter((story) => {
          const content = [
            story.title,
            story.description,
            ...(story.comments?.map((comment) => comment.text) ?? []),
          ]
            .filter(Boolean)
            .map((entry) =>
              String(entry)
                .replace(/<[^>]+>/g, " ")
                .toLowerCase()
            );
          return content.some((entry) => entry.includes(term));
        });
      }
      if (view === "week" || view === "yearly" || view === "kanban") {
        if (statusFilters.length === 0) {
          result = [];
        } else {
          result = result.filter((story) => statusFilters.includes(story.status));
        }
        if (typeOfWorkFilters.length === 0) {
          result = [];
        } else {
          result = result.filter((story) => {
            const value = story.typeOfWork?.trim();
            if (!value) return typeOfWorkFilters.includes("__unassigned__");
            return typeOfWorkFilters.includes(value);
          });
        }
      }
      if (view === "week" || view === "kanban") {
        if (dueFilter === "today") {
          const today = new Date();
          result = result.filter(
            (story) =>
              story.dueDates?.some((date) => isSameDay(date, today)) ?? false
          );
        } else if (dueFilter === "next-week") {
          const today = new Date();
          const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
          const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
          result = result.filter(
            (story) =>
              story.dueDates?.some(
                (date) => date >= nextWeekStart && date <= nextWeekEnd
              ) ?? false
          );
        }
      }

      return result;
    },
    [
      normalizedStories,
      selectedEpicId,
      searchQuery,
      statusFilters,
      typeOfWorkFilters,
      dueFilter,
      yearlyStories,
      regularStories,
    ]
  );

  const filteredStories = useMemo(
    () => buildFilteredStories(activeView),
    [buildFilteredStories, activeView]
  );

  const modalFilteredStories = useMemo(
    () => buildFilteredStories(modalActiveView),
    [buildFilteredStories, modalActiveView]
  );

  const storyCounts = useMemo(() => {
    const source = activeView === "yearly" ? yearlyStories : regularStories;
    const counts: Record<string, number> = {};
    source
      .filter((s) => !s.isDeleted)
      .forEach((story) => {
        counts[story.epicId] = (counts[story.epicId] || 0) + 1;
      });
    return counts;
  }, [activeView, regularStories, yearlyStories]);

  const modalStoryCounts = useMemo(() => {
    const source = modalActiveView === "yearly" ? yearlyStories : regularStories;
    const counts: Record<string, number> = {};
    source
      .filter((s) => !s.isDeleted)
      .forEach((story) => {
        counts[story.epicId] = (counts[story.epicId] || 0) + 1;
      });
    return counts;
  }, [modalActiveView, regularStories, yearlyStories]);


  const activeEpics = useMemo(() => epics.filter((epic) => !epic.isArchived), [epics]);
  const archivedEpics = useMemo(() => epics.filter((epic) => epic.isArchived), [epics]);
  const adminEpics = useMemo(() => {
    const source = showArchived ? archivedEpics : activeEpics;
    return source.slice().sort((a, b) => {
      const rank = (epic: Epic) => {
        if (epic.id === NO_EPIC_ID || epic.name === NO_EPIC_NAME) return 0;
        if (
          epic.id === DOC_EPIC_ID ||
          epic.name === DOC_EPIC_NAME ||
          epic.name === DOC_EPIC_LEGACY_NAME
        )
          return 1;
        return 2;
      };
      const rankA = rank(a);
      const rankB = rank(b);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA < 2) return 0;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [showArchived, archivedEpics, activeEpics]);

  useEffect(() => {
    const normalized = ensureNoEpicAssigned(epics, stories);
    if (normalized.epics !== epics) {
      setEpics(normalized.epics);
    }
    const statusNormalized = normalized.stories.map((story) =>
      story.status === "Doing" ? { ...story, status: "To Do" } : story
    );
    const didStatusNormalize = statusNormalized.some(
      (story, idx) => story !== normalized.stories[idx]
    );
    if (normalized.stories !== stories || didStatusNormalize) {
      setStories(didStatusNormalize ? statusNormalized : normalized.stories);
    }
  }, [epics, stories]);

  const handleSelectEpic = useCallback(
    (epicId: string | null) => {
      setSelectedEpicId(epicId);
      if (epicId) {
        if (activeView !== "search" && activeView !== "yearly") {
          setActiveView("week");
        }
        setSelectedStoryId(null);
      }
    },
    [activeView]
  );

  const handleViewChange = useCallback(
    (view: string) => {
      if (requiresStorageSetup && view !== "settings") return;
      setActiveView(view);
      if (view === "search") {
        setSelectedEpicId(null);
        setSelectedStoryId(null);
      }
      if (view === "week" || view === "yearly" || view === "kanban") {
        setSelectedEpicId(null);
        setSelectedStoryId(null);
      }
      if (view === "inbox") {
        setSelectedStoryId(null);
      }
      if (!["week", "kanban"].includes(view)) {
        setDueFilter("all");
      }
    },
    [requiresStorageSetup]
  );

  const handleStorageReady = useCallback(() => {
    const refresh = async () => {
      const ctx = await loadDb();
      dbContextRef.current = ctx;
      setRequiresStorageSetup(ctx.mode !== "fs");
      if (ctx.mode !== "fs") return;
      const cfg = loadWorkflowConfig(ctx.db);
      setWorkflow(cfg);
      if (cfg.accent === "teal") setAccentColor("#14B8A6");
      const inboxState = loadInboxState(ctx.db);
      const normalized = ensureNoEpicAssigned(inboxState.epics, inboxState.stories);
      setEpics(normalized.epics);
      setStories(normalized.stories);
      setShowArchived(Boolean(inboxState.preferences.showArchived));
      if (Array.isArray(inboxState.preferences.typeOfWorkOptions)) {
        setTypeOfWorkOptions(inboxState.preferences.typeOfWorkOptions);
      }
      setListPaneWidth(inboxState.preferences.listPaneWidth ?? INBOX_LIST_WIDTH);
      setEpicsPaneWidth(clampPaneWidth(inboxState.preferences.epicsPaneWidth ?? 208));
      setIsEpicsPaneCollapsed(Boolean(inboxState.preferences.epicsPaneCollapsed));
      await persistDb(ctx);
    };
    refresh();
  }, []);

  const handleCreateEpic = useCallback(
    (epicData: Omit<Epic, "id" | "createdAt">) => {
      const newEpic: Epic = {
        ...epicData,
        id: String(Date.now()),
        createdAt: new Date(),
      };
      setEpics((prev) => [...prev, newEpic]);
      setSelectedEpicId(newEpic.id);
    },
    []
  );

  const handleArchiveEpic = useCallback(
    (epicId: string) => {
      const epic = epics.find((entry) => entry.id === epicId);
      if (!epic || isSystemEpic(epic)) return;
      setEpics((prev) =>
        prev.map((epic) =>
          epic.id === epicId ? { ...epic, isArchived: true } : epic
        )
      );
      if (selectedEpicId === epicId) {
        setSelectedEpicId(null);
      }
    },
    [epics, selectedEpicId]
  );

  const handleDeleteEpic = useCallback(
    (epicId: string) => {
      const epic = epics.find((entry) => entry.id === epicId);
      if (!epic || isSystemEpic(epic)) return;
      const hasAssignedStories = stories.some(
        (story) => story.epicId === epicId && !story.isDeleted
      );
      if (hasAssignedStories) {
        window.alert(
          "This epic still has stories. Reassign them to another epic before deleting."
        );
        return;
      }
      setEpics((prev) => prev.filter((epic) => epic.id !== epicId));
      if (selectedEpicId === epicId) {
        setSelectedEpicId(null);
      }
    },
    [epics, stories, selectedEpicId]
  );

  const handleRenameEpicFromSidebar = useCallback(
    (epicId: string) => {
      const epic = epics.find((entry) => entry.id === epicId);
      if (!epic || isSystemEpic(epic)) return;
      const nextName = window.prompt("Rename epic", epic.name)?.trim();
      if (!nextName || nextName === epic.name) return;
      setEpics((prev) =>
        prev.map((entry) => (entry.id === epicId ? { ...entry, name: nextName } : entry))
      );
    },
    [epics]
  );

  const handleRestoreEpic = useCallback((epicId: string) => {
    setEpics((prev) =>
      prev.map((epic) => (epic.id === epicId ? { ...epic, isArchived: false } : epic))
    );
  }, []);

  const startEditField = useCallback((epic: Epic, field: "name" | "key" | "description") => {
    if (isSystemEpic(epic)) return;
    setEditingField({ id: epic.id, field });
    if (field === "name") setEditValue(epic.name);
    if (field === "key") setEditValue(epic.key);
    if (field === "description") setEditValue(epic.description);
  }, []);

  const handleUpdateEpicColor = useCallback((epicId: string, color: string) => {
    setEpics((prev) =>
      prev.map((epic) => (epic.id === epicId ? { ...epic, color } : epic))
    );
  }, []);

  const cancelEditField = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  const saveEditField = useCallback(() => {
    if (!editingField) return;
    setEpics((prev) =>
      prev.map((epic) => {
        if (epic.id !== editingField.id) return epic;
        if (editingField.field === "name") {
          const nextName = editValue.trim();
          return nextName ? { ...epic, name: nextName } : epic;
        }
        if (editingField.field === "key") {
          const nextKey = editValue
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 3)
            .toUpperCase();
          return nextKey ? { ...epic, key: nextKey } : epic;
        }
        return { ...epic, description: editValue.trim() };
      })
    );
    cancelEditField();
  }, [editingField, editValue, cancelEditField]);

  const handleCreateStory = useCallback(
    (storyData: Omit<Story, "id" | "key" | "createdAt">) => {
      const epic = epics.find((e) => e.id === storyData.epicId);
      const epicStoryCount = stories.filter((s) => s.epicId === storyData.epicId).length;
      const normalizedDueDates = (storyData.dueDates ?? [])
        .map((date) => (date instanceof Date ? date : new Date(date)))
        .filter((date) => !Number.isNaN(date.getTime()));
      const storyCode = getNextStoryCode(stories);
      const fallbackDueDates = storyData.isYearly ? [] : [new Date()];
      const dueDates =
        normalizedDueDates.length > 0 ? normalizedDueDates : fallbackDueDates;
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

  const handleQuickAddStory = useCallback(
    (title: string, view: string = activeView) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;
      const availableEpics = epics.filter((epic) => !epic.isArchived);
      const noEpicId =
        availableEpics.find(
          (epic) =>
            epic.id === "no-epic-assigned" ||
            epic.name.toLowerCase() === "no epic assigned"
        )?.id ?? "";
      const defaultEpicId =
        availableEpics.find((epic) => epic.id === selectedEpicId)?.id ??
        noEpicId ??
        availableEpics[0]?.id ??
        "";
      if (!defaultEpicId) return;
      const isYearly = view === "yearly";
      const nextStatus = "New";
      const now = new Date();
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const dueDates = isYearly ? [] : [new Date()];
      handleCreateStory({
        title: trimmedTitle,
        description: "",
        epicId: defaultEpicId,
        dueDates,
        startDate: isYearly ? nextMonthStart : undefined,
        status: nextStatus,
        priority: "low",
        isYearly,
        typeOfWork: "",
      });
    },
    [activeView, epics, selectedEpicId, statusOptions, defaultStatus, handleCreateStory]
  );

  const handleUpdateStory = useCallback((updatedStory: Story) => {
    const epicMatch = epics.find((entry) => entry.id === updatedStory.epicId);
    const isDocEpic =
      updatedStory.epicId === DOC_EPIC_ID ||
      epicMatch?.name === DOC_EPIC_NAME ||
      epicMatch?.name === DOC_EPIC_LEGACY_NAME;
    const normalizedDueDates = (updatedStory.dueDates ?? [])
      .map((date) => (date instanceof Date ? date : new Date(date)))
      .filter((date) => !Number.isNaN(date.getTime()));
    const normalizedStatus =
      updatedStory.status === "Doing" ? "To Do" : updatedStory.status;
    const normalizedStory = {
      ...updatedStory,
      status: normalizedStatus,
      dueDates: normalizedDueDates,
    };
    const isCompletedStatus = isDocEpic
      ? updatedStory.status === "Saved"
      : updatedStory.status === doneStatus;
    if (isCompletedStatus && !updatedStory.completedAt) {
      normalizedStory.completedAt = new Date();
    }
    if (!isCompletedStatus) {
      normalizedStory.completedAt = undefined;
    }
      setStories((prev) =>
        prev.map((s) => (s.id === normalizedStory.id ? normalizedStory : s))
      );
  }, [doneStatus, epics]);

  const handleMoveStoryToBucket = useCallback(
    (storyId: string, targetBucket: KanbanBucket) => {
      const story = stories.find((s) => s.id === storyId);
      if (!story) return;
      const bucketStatuses = [...workflow.columns, "Saved"].filter(
        (status) =>
          (kanbanBuckets[status] ?? (status === "Saved" ? "completed" : "not-started")) ===
          targetBucket
      );
      const nextStatus =
        bucketStatuses[0] ??
        (targetBucket === "completed" ? doneStatus : defaultStatus);
      handleUpdateStory({ ...story, status: nextStatus });
    },
    [stories, workflow.columns, kanbanBuckets, doneStatus, defaultStatus, handleUpdateStory]
  );

  const handleAddTypeOfWork = useCallback((nextType: string) => {
    const trimmed = nextType.trim();
    if (!trimmed) return;
    setTypeOfWorkOptions((prev) => {
      if (prev.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const handleRenameEpicFromList = useCallback(() => {
    if (!selectedEpicId) return;
    const epic = epics.find((entry) => entry.id === selectedEpicId);
    if (!epic) return;
    const nextName = window.prompt("Rename epic list", epic.name)?.trim();
    if (!nextName || nextName === epic.name) return;
    setEpics((prev) =>
      prev.map((entry) =>
        entry.id === selectedEpicId ? { ...entry, name: nextName } : entry
      )
    );
  }, [epics, selectedEpicId]);

  const handleDeleteStory = useCallback(
    (storyId: string) => {
      const target = stories.find((story) => story.id === storyId);
      if (target && !window.confirm(`Delete "${target.title}"?`)) {
        return;
      }
      setStories((prev) =>
        prev.map((s) =>
          s.id === storyId
            ? { ...s, isDeleted: true, deletedAt: new Date() }
            : s
        )
      );
      if (selectedStoryId === storyId) {
        setSelectedStoryId(null);
      }
    },
    [selectedStoryId, stories]
  );

  const handleRestoreStory = useCallback((storyId: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId
          ? { ...s, isDeleted: false, deletedAt: undefined }
          : s
      )
    );
  }, []);

  const handlePermanentDelete = useCallback(
    (storyId: string) => {
      const target = stories.find((story) => story.id === storyId);
      if (target && !window.confirm(`Permanently delete "${target.title}"?`)) {
        return;
      }
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      if (selectedStoryId === storyId) {
        setSelectedStoryId(null);
      }
    },
    [selectedStoryId, stories]
  );
  const handleEmptyTrash = useCallback(() => {
    setStories((prev) => {
      const selectedIsDeleted = selectedStoryId
        ? prev.find((s) => s.id === selectedStoryId)?.isDeleted
        : false;
      if (selectedIsDeleted) {
        setSelectedStoryId(null);
      }
      return prev.filter((s) => !s.isDeleted);
    });
  }, [selectedStoryId]);

  const getViewTitle = () => {
    if (activeView === "notifications") return "Notifications";
    if (activeView === "trash") return "Trash";
    const currentEpic = epics.find((e) => e.id === selectedEpicId);
    if (currentEpic) return currentEpic.name;
    if (activeView === "todo") return "Todo";
    if (activeView === "notes") return "Notes";
    if (activeView === "oneonone") return "Meetings";
    if (activeView === "okrs") return "OKRs";
    if (activeView === "reporting") return "Reporting";
    if (activeView === "search") return "Search";
    if (activeView === "settings") return "Settings";
    if (activeView === "epics") return "Epics";
    if (activeView === "yearly") return "Yearly Inbox";
    if (activeView === "kanban") return "Kanban";
    return "Inbox";
  };

  const isKanbanView = activeView === "kanban";
  const dateMode = activeView === "yearly" ? "month" : "day";
  const modalDateMode = modalActiveView === "yearly" ? "month" : "day";
  const modalViewTitle =
    modalActiveView === "trash"
      ? "Trash"
      : modalActiveView === "yearly"
      ? "Yearly Inbox"
      : modalActiveView === "search"
      ? "Search"
      : "Inbox";
  const sidebarActiveView = useMemo(() => {
    if (["epics", "trash"].includes(activeView)) return "week";
    return activeView;
  }, [activeView]);
  useEffect(() => {
    if (requiresStorageSetup && activeView !== "settings") {
      setActiveView("settings");
    }
  }, [requiresStorageSetup, activeView]);
  useEffect(() => {
    if (!isResizingListPane) return;
    const handleMouseMove = (event: MouseEvent) => {
      const container = detailContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offset = rect.left + epicsPaneTotalWidth;
      const nextWidth = event.clientX - offset;
      const maxWidth = Math.max(0, rect.width * LIST_MAX_RATIO);
      const clamped = Math.min(maxWidth, Math.max(LIST_MIN_WIDTH, nextWidth));
      setListPaneWidth(clamped);
    };
    const handleMouseUp = () => setIsResizingListPane(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingListPane, epicsPaneTotalWidth]);

  useEffect(() => {
    if (!isResizingEpicsPane) return;
    const handleMouseMove = (event: MouseEvent) => {
      const container = detailContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextWidth = rect.right - event.clientX;
      const minWidth = 180;
      const maxWidth = rect.width * 0.4;
      const clamped = Math.min(maxWidth, Math.max(minWidth, nextWidth));
      setEpicsPaneWidth(clampPaneWidth(clamped));
    };
    const handleMouseUp = () => setIsResizingEpicsPane(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingEpicsPane]);

  useEffect(() => {
    const container = detailContainerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setDetailContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    setDetailContainerWidth(container.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const persistLatest = async () => {
      const ctx = await loadDb();
      dbContextRef.current = ctx;
      saveInboxState(ctx.db, {
        epics,
        stories,
        preferences: {
          showArchived,
          listPaneWidth,
          epicsPaneWidth,
          epicsPaneCollapsed: isEpicsPaneCollapsed,
          typeOfWorkOptions,
        },
      });
      await persistDb(ctx);
    };
    persistLatest();
  }, [
    epics,
    stories,
    showArchived,
    listPaneWidth,
    epicsPaneWidth,
    isEpicsPaneCollapsed,
    typeOfWorkOptions,
    isHydrated,
  ]);
  useEffect(() => {
    const handleExternalUpdate = async () => {
      const ctx = await loadDb();
      dbContextRef.current = ctx;
      const inboxState = loadInboxState(ctx.db);
      const normalized = ensureNoEpicAssigned(inboxState.epics, inboxState.stories);
      setEpics(normalized.epics);
      setStories(normalized.stories);
      await persistDb(ctx);
    };
    const handleOpenInboxStory = (event: Event) => {
      const custom = event as CustomEvent<{ storyId?: string }>;
      const storyId =
        custom.detail?.storyId ??
        window.sessionStorage.getItem("open-inbox-story-id") ??
        "";
      if (!storyId) return;
      setIsInboxModalOpen(true);
      setModalActiveView("week");
      setSelectedStoryId(storyId);
      window.sessionStorage.removeItem("open-inbox-story-id");
    };
    window.addEventListener("inbox-stories-updated", handleExternalUpdate);
    window.addEventListener("meeting-participants-updated", handleExternalUpdate);
    window.addEventListener("open-inbox-story", handleOpenInboxStory as EventListener);
    return () => {
      window.removeEventListener("inbox-stories-updated", handleExternalUpdate);
      window.removeEventListener("meeting-participants-updated", handleExternalUpdate);
      window.removeEventListener("open-inbox-story", handleOpenInboxStory as EventListener);
    };
  }, []);
  useEffect(() => {
    if (isInboxModalOpen) {
      setIsModalEpicsPaneCollapsed(true);
    }
  }, [isInboxModalOpen]);

  const upcomingNotifications = useMemo(() => {
    return regularStories
      .filter((story) => !story.isDeleted && !isStoryDone(story))
      .sort(
        (a, b) =>
          getEffectiveDueDate(a).getTime() - getEffectiveDueDate(b).getTime()
      )
      .slice(0, 5);
  }, [regularStories, isStoryDone]);

  const handleRefresh = useCallback(() => {
    const refresh = async () => {
      const ctx = await loadDb();
      dbContextRef.current = ctx;
      setRequiresStorageSetup(ctx.mode !== "fs");
      const cfg = loadWorkflowConfig(ctx.db);
      setWorkflow(cfg);
      if (cfg.accent === "teal") setAccentColor("#14B8A6");
      const inboxState = loadInboxState(ctx.db);
      const normalized = ensureNoEpicAssigned(inboxState.epics, inboxState.stories);
      setEpics(normalized.epics);
      setStories(normalized.stories);
      setShowArchived(Boolean(inboxState.preferences.showArchived));
      if (Array.isArray(inboxState.preferences.typeOfWorkOptions)) {
        setTypeOfWorkOptions(inboxState.preferences.typeOfWorkOptions);
      }
      setListPaneWidth(inboxState.preferences.listPaneWidth ?? INBOX_LIST_WIDTH);
      setEpicsPaneWidth(clampPaneWidth(inboxState.preferences.epicsPaneWidth ?? 208));
      setIsEpicsPaneCollapsed(Boolean(inboxState.preferences.epicsPaneCollapsed));
      setSelectedEpicId(null);
      setSelectedStoryId(null);
      setActiveView("week");
      await persistDb(ctx);
    };
    refresh();
  }, []);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <IconSidebar
        activeView={sidebarActiveView}
        onViewChange={handleViewChange}
        onRefresh={handleRefresh}
        user={user}
      />
      <button
        type="button"
        className="fixed right-6 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-panel-border bg-card/90 text-foreground shadow-sm transition hover:bg-card"
        onClick={() => {
          setIsInboxModalOpen(true);
          setModalActiveView("week");
        }}
        title="Open inbox"
        aria-label="Open inbox"
      >
        <Inbox className="h-5 w-5" />
      </button>

      {requiresStorageSetup ? (
        <div className="flex-1 bg-background flex flex-col h-full min-w-0">
          <div className="px-6 py-4 border-b border-panel-border">
            <div className="text-lg font-semibold text-foreground">Settings</div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <DataStoragePanel
              workflow={workflow}
              onUpdateWorkflow={async (next) => {
                setWorkflow(next);
                if (next.accent === "teal") setAccentColor("#14B8A6");
                else setAccentColor("#6366F1");
                const ctx = await loadDb();
                saveWorkflowConfig(ctx.db, next);
                await persistDb(ctx);
              }}
              onStorageReady={handleStorageReady}
              requiresStorageSetup={requiresStorageSetup}
              typeOfWorkOptions={typeOfWorkOptions}
              onPersistTypeOfWorkOptions={persistTypeOfWorkOptions}
              statusUsageCounts={statusUsageCounts}
              typeUsageCounts={typeUsageCounts}
            />
          </div>
        </div>
      ) : isInboxView ? (
        <>
          {isKanbanView ? (
            <div className="flex-1 bg-background flex flex-col h-full min-w-0 overflow-hidden">
              <div className="flex h-full min-h-0">
                <div className="flex-1 overflow-hidden p-4">
                  <StoryKanban
                    stories={filteredStories}
                    epics={epics}
                    statusOrder={workflow.columns}
                    bucketMap={kanbanBuckets}
                    selectedStoryId={selectedStoryId}
                    onSelectStory={setSelectedStoryId}
                    onMoveStory={handleMoveStoryToBucket}
                    statusFilters={statusFilters}
                    typeOfWorkFilters={typeOfWorkFilters}
                    statusFilterOptions={allStatusFilterOptions}
                    typeFilterOptions={allTypeFilterOptions}
                    dueFilter={dueFilter}
                    onStatusFiltersChange={setStatusFilters}
                    onTypeOfWorkFiltersChange={setTypeOfWorkFilters}
                    onDueFilterChange={setDueFilter}
                  />
                </div>
                <div className="w-px bg-panel-border" />
                <div className="w-[420px] shrink-0 border-l border-panel-border bg-card">
                  {selectedStory ? (
                    <StoryDetail
                      story={selectedStory}
                      epic={epics.find((e) => e.id === selectedStory.epicId)}
                      epics={epics}
                      statusOptions={statusOptions}
                      doneStatus={doneStatus}
                      defaultStatus={defaultStatus}
                      dateMode={dateMode}
                      typeOfWorkOptions={typeOfWorkOptions}
                      onAddTypeOfWork={handleAddTypeOfWork}
                      onUpdateStory={handleUpdateStory}
                      onOpenMeetings={() => setActiveView("oneonone")}
                      onDeleteStory={handleDeleteStory}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <EmptyState
                        title="No story selected"
                        description="Select a story to view details"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div ref={detailContainerRef} className="flex h-full flex-1 min-w-0">
              <div className="relative flex h-full">
                <button
                  type="button"
                  className="flex h-full w-6 flex-col items-center justify-start border border-panel-border bg-card/70 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-all hover:bg-card"
                  onClick={() => setIsEpicsPaneCollapsed((prev) => !prev)}
                  title={isEpicsPaneCollapsed ? "Show epics list" : "Hide epics list"}
                >
                  <span className="inline-block rotate-180 [writing-mode:vertical-rl]">
                    {isEpicsPaneCollapsed ? "Show epics list" : "Hide epics list"}
                  </span>
                </button>
                <div
                  className={`flex items-stretch transition-all duration-200 ${
                    isEpicsPaneCollapsed ? "w-0 opacity-0" : "opacity-100"
                  }`}
                >
                  {!isEpicsPaneCollapsed && (
                    <>
                      <ListSidebar
                        epics={activeEpics}
                        selectedEpicId={selectedEpicId}
                        onSelectEpic={handleSelectEpic}
                        onCreateEpic={() => setIsCreateEpicOpen(true)}
                        storyCounts={storyCounts}
                        activeView={activeView}
                        onViewChange={handleViewChange}
                        width={clampPaneWidth(epicsPaneWidth)}
                        onRenameEpic={handleRenameEpicFromSidebar}
                        onDeleteEpic={handleArchiveEpic}
                      />
                      <div
                        className="w-1 cursor-col-resize bg-transparent hover:bg-border"
                        onMouseDown={() => setIsResizingEpicsPane(true)}
                        title="Resize epics pane"
                      />
                      <div className="w-px bg-panel-border" />
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0" style={{ width: effectiveListWidth }}>
                <StoryList
                  stories={filteredStories}
                  epics={epics}
                  statusOptions={statusOptions}
                  doneStatus={doneStatus}
                  defaultStatus={defaultStatus}
                  savedStatusIndex={workflow.savedStatusIndex}
                  statusFilters={statusFilters}
                  typeOfWorkFilters={typeOfWorkFilters}
                  onStatusFiltersChange={setStatusFilters}
                  onTypeOfWorkFiltersChange={setTypeOfWorkFilters}
                  typeOfWorkOptions={typeOfWorkOptions}
                  statusFilterOptions={allStatusFilterOptions}
                  typeFilterOptions={allTypeFilterOptions}
                  selectedStoryId={selectedStoryId}
                  onSelectStory={setSelectedStoryId}
                  onCreateStory={(title) => handleQuickAddStory(title, activeView)}
                  onUpdateStory={handleUpdateStory}
                  onDeleteStory={handleDeleteStory}
                  onRestoreStory={handleRestoreStory}
                  onPermanentDelete={handlePermanentDelete}
                  onEmptyTrash={handleEmptyTrash}
                  viewTitle={getViewTitle()}
                  activeView={activeView}
                  dateMode={dateMode}
                  dueFilter={dueFilter}
                  onDueFilterChange={setDueFilter}
                  canRenameEpic={
                    Boolean(selectedEpicId) &&
                    selectedEpicId !== "no-epic-assigned" &&
                    selectedEpicId !== "week" &&
                    getViewTitle() !== "Inbox" &&
                    activeView === "week"
                  }
                  onRenameEpic={handleRenameEpicFromList}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onCompletedDateChange={(storyId, completedAt) => {
                    const target = stories.find((s) => s.id === storyId);
                    if (!target) return;
                    handleUpdateStory({ ...target, completedAt });
                  }}
                />
              </div>
              <div
                className="w-1 cursor-col-resize bg-transparent hover:bg-border"
                onMouseDown={() => setIsResizingListPane(true)}
                title="Resize inbox list"
              />
              <div className="flex h-full min-w-0 flex-1 border-l border-panel-border bg-card">
                {selectedStory ? (
                  <StoryDetail
                    story={selectedStory}
                    epic={epics.find((e) => e.id === selectedStory.epicId)}
                    epics={epics}
                    statusOptions={statusOptions}
                    doneStatus={doneStatus}
                    defaultStatus={defaultStatus}
                    dateMode={dateMode}
                    typeOfWorkOptions={typeOfWorkOptions}
                    onAddTypeOfWork={handleAddTypeOfWork}
                    onUpdateStory={handleUpdateStory}
                    onOpenMeetings={() => setActiveView("oneonone")}
                    onDeleteStory={handleDeleteStory}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <EmptyState
                      title="No story selected"
                      description="Select a story to view details"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : activeView === "notifications" ? (
        <NotificationCenter
          notifications={upcomingNotifications}
          doneStatus={doneStatus}
        />
      ) : (
        <div className="flex-1 bg-background flex flex-col h-full min-w-0">
          <div className="px-6 py-4 border-b border-panel-border">
            <div className="text-lg font-semibold text-foreground">{getViewTitle()}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {activeView === "settings" ? (
              <DataStoragePanel
                workflow={workflow}
                onUpdateWorkflow={async (next) => {
                  setWorkflow(next);
                  if (next.accent === "teal") setAccentColor("#14B8A6");
                  else setAccentColor("#6366F1");
                  const ctx = await loadDb();
                  saveWorkflowConfig(ctx.db, next);
                  await persistDb(ctx);
                }}
                onStorageReady={handleStorageReady}
                requiresStorageSetup={requiresStorageSetup}
                typeOfWorkOptions={typeOfWorkOptions}
                onPersistTypeOfWorkOptions={persistTypeOfWorkOptions}
                statusUsageCounts={statusUsageCounts}
                typeUsageCounts={typeUsageCounts}
              />
            ) : activeView === "notes" ? (
              <MeetingNotes lanes={workflow.columns} swimlanes={workflow.swimlanes} />
            ) : activeView === "oneonone" ? (
              <OneOnOneFeed
                userFirstName={firstName}
              />
            ) : activeView === "okrs" ? (
              <OKRPage focusId={focusedOkr} />
            ) : activeView === "reporting" ? (
              <ReportingView />
            ) : null}
          </div>
        </div>
      )}

      <Dialog
        open={isInboxModalOpen}
        onOpenChange={(open) => {
          setIsInboxModalOpen(open);
          if (open) setModalActiveView("week");
        }}
      >
        <DialogContent className="max-w-[98vw] h-[90vh] w-[1700px] overflow-hidden p-0">
          <div className="flex h-full min-h-0">
            <div className="relative flex h-full">
              <button
                type="button"
                className="flex h-full w-6 flex-col items-center justify-start border border-panel-border bg-card/70 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-all hover:bg-card"
                onClick={() => setIsModalEpicsPaneCollapsed((prev) => !prev)}
                title={isModalEpicsPaneCollapsed ? "Show epics list" : "Hide epics list"}
              >
                <span className="inline-block rotate-180 [writing-mode:vertical-rl]">
                  {isModalEpicsPaneCollapsed ? "Show epics list" : "Hide epics list"}
                </span>
              </button>
              <div
                className={`flex items-stretch transition-all duration-200 ${
                  isModalEpicsPaneCollapsed ? "w-0 opacity-0" : "opacity-100"
                }`}
              >
                {!isModalEpicsPaneCollapsed && (
                  <>
                    <ListSidebar
                      epics={activeEpics}
                      selectedEpicId={selectedEpicId}
                      onSelectEpic={handleSelectEpic}
                      onCreateEpic={() => setIsCreateEpicOpen(true)}
                      storyCounts={modalStoryCounts}
                      activeView={modalActiveView}
                      onViewChange={setModalActiveView}
                      width={clampPaneWidth(epicsPaneWidth)}
                      onRenameEpic={handleRenameEpicFromSidebar}
                      onDeleteEpic={handleArchiveEpic}
                    />
                    <div
                      className="w-1 cursor-col-resize bg-transparent hover:bg-border"
                      onMouseDown={() => setIsResizingEpicsPane(true)}
                      title="Resize epics pane"
                    />
                    <div className="w-px bg-panel-border" />
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0" style={{ width: modalListWidth }}>
              <StoryList
                stories={modalFilteredStories}
                epics={epics}
                statusOptions={statusOptions}
                doneStatus={doneStatus}
                defaultStatus={defaultStatus}
                savedStatusIndex={workflow.savedStatusIndex}
                statusFilters={statusFilters}
                typeOfWorkFilters={typeOfWorkFilters}
                onStatusFiltersChange={setStatusFilters}
                onTypeOfWorkFiltersChange={setTypeOfWorkFilters}
                typeOfWorkOptions={typeOfWorkOptions}
                statusFilterOptions={allStatusFilterOptions}
                typeFilterOptions={allTypeFilterOptions}
                selectedStoryId={selectedStoryId}
                onSelectStory={setSelectedStoryId}
                onCreateStory={(title) => handleQuickAddStory(title, modalActiveView)}
                onUpdateStory={handleUpdateStory}
                onDeleteStory={handleDeleteStory}
                onRestoreStory={handleRestoreStory}
                onPermanentDelete={handlePermanentDelete}
                onEmptyTrash={handleEmptyTrash}
                viewTitle={modalViewTitle}
                activeView={modalActiveView}
                dateMode={modalDateMode}
                dueFilter={dueFilter}
                onDueFilterChange={setDueFilter}
                canRenameEpic={
                  Boolean(selectedEpicId) &&
                  selectedEpicId !== "no-epic-assigned" &&
                  selectedEpicId !== "week" &&
                  modalActiveView === "week"
                }
                onRenameEpic={handleRenameEpicFromList}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCompletedDateChange={(storyId, completedAt) => {
                  const target = stories.find((s) => s.id === storyId);
                  if (!target) return;
                  handleUpdateStory({ ...target, completedAt });
                }}
              />
            </div>
            <div className="flex h-full min-w-0 flex-1 border-l border-panel-border bg-card">
              {selectedStory ? (
                <StoryDetail
                  story={selectedStory}
                  epic={epics.find((e) => e.id === selectedStory.epicId)}
                  epics={epics}
                  statusOptions={statusOptions}
                  doneStatus={doneStatus}
                  defaultStatus={defaultStatus}
                  dateMode={modalDateMode}
                  typeOfWorkOptions={typeOfWorkOptions}
                  onAddTypeOfWork={handleAddTypeOfWork}
                  onUpdateStory={handleUpdateStory}
                  onOpenMeetings={() => setActiveView("oneonone")}
                  onDeleteStory={handleDeleteStory}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <EmptyState
                    title="No story selected"
                    description="Select a story to view details"
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateEpicDialog
        open={isCreateEpicOpen}
        onOpenChange={(open) => {
          setIsCreateEpicOpen(open);
        }}
        onCreateEpic={handleCreateEpic}
        usedColors={epics.map((epic) => epic.color)}
      />
      <CreateEpicDialog
        open={isEditEpicOpen}
        onOpenChange={(open) => {
          setIsEditEpicOpen(open);
          if (!open) setEditingEpic(null);
        }}
        onCreateEpic={handleCreateEpic}
        usedColors={epics
          .filter((epic) => epic.id !== editingEpic?.id)
          .map((epic) => epic.color)}
        mode="edit"
        initialEpic={editingEpic}
        onUpdateEpic={handleUpdateEpicColor}
      />
    </div>
  );
};

type NotificationCenterProps = {
  notifications: Story[];
  doneStatus: string;
};

function NotificationCenter({ notifications, doneStatus }: NotificationCenterProps) {
  return (
    <div className="flex-1 bg-background flex flex-col h-full min-w-0">
      <div className="px-6 py-4 border-b border-panel-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notifications
            </p>
            <h2 className="text-lg font-semibold text-foreground">Activity</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {notifications.length} {notifications.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're all caught up!</p>
        ) : (
          notifications.map((story) => (
            <article
              key={story.id}
              className="rounded-lg border border-panel-border bg-card/80 px-4 py-3 text-sm"
            >
              <div className="font-medium text-foreground">{story.title}</div>
              <p className="text-xs text-muted-foreground">
                Due {format(getEffectiveDueDate(story), "MMM d")} •{" "}
                {story.status === doneStatus || story.status === "Saved"
                  ? "Completed"
                  : story.status === "In progress"
                  ? "In progress"
                  : "In queue"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {story.description}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default InboxDreamsShell;
