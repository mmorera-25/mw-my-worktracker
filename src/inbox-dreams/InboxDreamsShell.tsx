import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { IconSidebar } from "@inbox/components/IconSidebar";
import { ListSidebar } from "@inbox/components/ListSidebar";
import { StoryList } from "@inbox/components/StoryList";
import { StoryDetail } from "@inbox/components/StoryDetail";
import { EmptyState } from "@inbox/components/EmptyState";
import { CreateEpicDialog } from "@inbox/components/CreateEpicDialog";
import { CreateStoryDialog } from "@inbox/components/CreateStoryDialog";
import type { Epic, Story } from "@inbox/types";
import DataStoragePanel from "../features/settings/DataStoragePanel";
import MeetingNotes from "../features/notes/MeetingNotes";
import OKRPage from "../features/okrs/OKRPage";
import OneOnOneFeed from "../features/oneonone/OneOnOneFeed";
import ReportingView from "../features/reporting/ReportingView";
import { loadDb, persistDb, type DbContext } from "../lib/storage/dbManager";
import { loadWorkflowConfig, saveWorkflowConfig, type WorkflowConfig } from "../lib/settings/configRepository";
import { setAccentColor } from "../theme/applyTheme";
import { loadInboxState, saveInboxState } from "@inbox/data/inboxRepository";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Archive, ArrowLeft } from "lucide-react";

type InboxDreamsShellProps = {
  user: FirebaseUser;
};

const NO_EPIC_ID = "no-epic-assigned";
const NO_EPIC_NAME = "No Epic Assigned";
const NO_EPIC_KEY = "NOEPIC";
const INBOX_LIST_WIDTH = 420;
const EPICS_BAR_WIDTH = 24;
const EPICS_RESIZER_WIDTH = 4;
const EPICS_SEPARATOR_WIDTH = 1;
const LIST_MIN_WIDTH = 320;
const LIST_MAX_RATIO = 0.7;

const ensureNoEpicAssigned = (epics: Epic[], stories: Story[]) => {
  const epicIds = new Set(epics.map((epic) => epic.id));
  const archivedEpicIds = new Set(
    epics.filter((epic) => epic.isArchived).map((epic) => epic.id)
  );
  const isMissingEpic = (story: Story) => {
    const trimmed = story.epicId?.trim?.() ?? "";
    if (!trimmed) return true;
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
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [pendingStoryAfterEpic, setPendingStoryAfterEpic] = useState(false);
  const [focusedOkr, setFocusedOkr] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowConfig>({
    columns: ["Backlog", "Scheduled", "On Hold / Waiting", "To Ask", "To Do", "Done"],
    swimlanes: ["Core", "Enablement", "Bugs"],
    accent: "indigo",
  });
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [pendingStoryTitle, setPendingStoryTitle] = useState("");
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
  const [showDueTodayOnly, setShowDueTodayOnly] = useState(false);
  const [showDueThisWeekOnly, setShowDueThisWeekOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarRightWidth, setCalendarRightWidth] = useState(320);
  const [isResizingCalendarRight, setIsResizingCalendarRight] = useState(false);
  const [epicsPaneWidth, setEpicsPaneWidth] = useState(208);
  const [isResizingEpicsPane, setIsResizingEpicsPane] = useState(false);
  const [isEpicsPaneCollapsed, setIsEpicsPaneCollapsed] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(null);
  const [detailContainerWidth, setDetailContainerWidth] = useState(0);
  const detailContainerRef = useRef<HTMLDivElement | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
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
        "today",
        "week",
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
  const defaultStatus = useMemo(
    () => workflow.columns[0] ?? "Backlog",
    [workflow.columns]
  );
  const statusOptions = useMemo(
    () => workflow.columns.filter((column) => column !== "Doing"),
    [workflow.columns]
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
      setCalendarRightWidth(inboxState.preferences.calendarRightWidth ?? 320);
      setEpicsPaneWidth(clampPaneWidth(inboxState.preferences.epicsPaneWidth ?? 208));
      setIsEpicsPaneCollapsed(Boolean(inboxState.preferences.epicsPaneCollapsed));
      await persistDb(ctx);
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

  const filteredStories = useMemo(() => {
    let result =
      activeView === "yearly"
        ? yearlyStories
        : activeView === "trash"
        ? normalizedStories
        : regularStories;

    if (activeView === "trash") {
      result = result.filter((s) => s.isDeleted);
    } else {
      result = result.filter((s) => !s.isDeleted);
    }

    if (selectedEpicId && !["completed", "trash"].includes(activeView)) {
      result = result.filter((s) => s.epicId === selectedEpicId);
    }
    if (activeView === "search" && searchQuery.trim()) {
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
    if (activeView === "week") {
      if (showDueTodayOnly) {
        const today = new Date();
        result = result.filter(
          (story) =>
            story.dueDates?.some((date) => isSameDay(date, today)) ?? false
        );
      } else if (showDueThisWeekOnly) {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
        result = result.filter(
          (story) =>
            story.dueDates?.some(
              (date) => date >= weekStart && date <= weekEnd
            ) ?? false
        );
      }
    }

    return result;
  }, [
    normalizedStories,
    selectedEpicId,
    activeView,
    doneStatus,
    showDueTodayOnly,
    showDueThisWeekOnly,
    searchQuery,
    yearlyStories,
    regularStories,
  ]);

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


  const activeEpics = useMemo(() => epics.filter((epic) => !epic.isArchived), [epics]);
  const archivedEpics = useMemo(() => epics.filter((epic) => epic.isArchived), [epics]);

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
      if (view === "week" || view === "yearly") {
        setSelectedEpicId(null);
        setSelectedStoryId(null);
      }
      if (view === "inbox") {
        setSelectedStoryId(null);
      }
      if (view !== "week") {
        setShowDueTodayOnly(false);
        setShowDueThisWeekOnly(false);
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
      setCalendarRightWidth(inboxState.preferences.calendarRightWidth ?? 320);
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
      if (pendingStoryAfterEpic) {
        setIsCreateStoryOpen(true);
        setPendingStoryAfterEpic(false);
      }
    },
    [pendingStoryAfterEpic]
  );

  const handleArchiveEpic = useCallback(
    (epicId: string) => {
      setEpics((prev) =>
        prev.map((epic) =>
          epic.id === epicId ? { ...epic, isArchived: true } : epic
        )
      );
      if (selectedEpicId === epicId) {
        setSelectedEpicId(null);
      }
    },
    [selectedEpicId]
  );

  const handleRenameEpicFromSidebar = useCallback(
    (epicId: string) => {
      const epic = epics.find((entry) => entry.id === epicId);
      if (!epic || epic.id === NO_EPIC_ID || epic.name === NO_EPIC_NAME) return;
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
      const newStory: Story = {
        ...storyData,
        id: String(Date.now()),
        key: `${epic?.key || "TASK"}-${epicStoryCount + 100}`,
        createdAt: new Date(),
        dueDates:
          normalizedDueDates.length > 0 ? normalizedDueDates : [new Date()],
        isYearly: Boolean(storyData.isYearly),
      };
      setStories((prev) => [...prev, newStory]);
      setSelectedStoryId(newStory.id);
    },
    [epics, stories]
  );

  const handleQuickAddStory = useCallback(
    (title: string) => {
      setPendingStoryTitle(title);
      setIsCreateStoryOpen(true);
    },
    []
  );

  const handleUpdateStory = useCallback((updatedStory: Story) => {
    const normalizedDueDates = (updatedStory.dueDates ?? [])
      .map((date) => (date instanceof Date ? date : new Date(date)))
      .filter((date) => !Number.isNaN(date.getTime()));
    const normalizedStatus =
      updatedStory.status === "Doing" ? "To Do" : updatedStory.status;
    const normalizedStory = {
      ...updatedStory,
      status: normalizedStatus,
      dueDates:
        normalizedDueDates.length > 0 ? normalizedDueDates : [updatedStory.createdAt],
    };
    if (updatedStory.status === doneStatus && !updatedStory.completedAt) {
      normalizedStory.completedAt = new Date();
    }
    if (updatedStory.status !== doneStatus) {
      normalizedStory.completedAt = undefined;
    }
    setStories((prev) =>
      prev.map((s) => (s.id === normalizedStory.id ? normalizedStory : s))
    );
  }, [doneStatus]);

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
    [selectedStoryId]
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
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      if (selectedStoryId === storyId) {
        setSelectedStoryId(null);
      }
    },
    [selectedStoryId]
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
    return "Inbox";
  };

  const isCalendarView = activeView === "today";
  const dateMode = activeView === "yearly" ? "month" : "day";
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
    if (!isResizingCalendarRight) return;
    const handleMouseMove = (event: MouseEvent) => {
      const container = calendarContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextWidth = rect.right - event.clientX;
      const minWidth = 240;
      const maxWidth = rect.width * 0.6;
      const clamped = Math.min(maxWidth, Math.max(minWidth, nextWidth));
      setCalendarRightWidth(clamped);
    };
    const handleMouseUp = () => setIsResizingCalendarRight(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingCalendarRight]);

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
    const ctx = dbContextRef.current;
    if (!ctx) return;
    saveInboxState(ctx.db, {
      epics,
      stories,
      preferences: {
        showArchived,
        listPaneWidth,
        calendarRightWidth,
        epicsPaneWidth,
        epicsPaneCollapsed: isEpicsPaneCollapsed,
        typeOfWorkOptions,
      },
    });
    persistDb(ctx);
  }, [
    epics,
    stories,
    showArchived,
    listPaneWidth,
    calendarRightWidth,
    epicsPaneWidth,
    isEpicsPaneCollapsed,
    typeOfWorkOptions,
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
    window.addEventListener("inbox-stories-updated", handleExternalUpdate);
    return () => {
      window.removeEventListener("inbox-stories-updated", handleExternalUpdate);
    };
  }, []);
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
    const days = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [calendarMonth]);

  const storiesByDay = useMemo(() => {
    return regularStories.reduce<Record<string, Story[]>>((acc, story) => {
      if (story.isDeleted) return acc;
      if (story.status === doneStatus) return acc;
      const dates = getAllDueDates(story);
      const seen = new Set<string>();
      dates.forEach((date) => {
        const key = format(date, "yyyy-MM-dd");
        if (seen.has(key)) return;
        seen.add(key);
        if (!acc[key]) acc[key] = [];
        acc[key].push(story);
      });
      return acc;
    }, {});
  }, [regularStories, doneStatus]);

  const completedStoriesByDay = useMemo(() => {
    return regularStories.reduce<Record<string, Story[]>>((acc, story) => {
      if (story.isDeleted) return acc;
      if (!story.completedAt) return acc;
      const key = format(story.completedAt, "yyyy-MM-dd");
      if (!acc[key]) acc[key] = [];
      acc[key].push(story);
      return acc;
    }, {});
  }, [regularStories]);

  const todayDueTasks = useMemo(() => {
    const today = new Date();
    return regularStories
      .filter(
        (story) =>
          !story.isDeleted &&
          story.status !== doneStatus &&
          isSameDay(getEffectiveDueDate(story), today)
      )
      .sort(
        (a, b) =>
          getEffectiveDueDate(a).getTime() - getEffectiveDueDate(b).getTime()
      );
  }, [regularStories, doneStatus]);

  const upcomingNotifications = useMemo(() => {
    return regularStories
      .filter((story) => !story.isDeleted && story.status !== doneStatus)
      .sort(
        (a, b) =>
          getEffectiveDueDate(a).getTime() - getEffectiveDueDate(b).getTime()
      )
      .slice(0, 5);
  }, [regularStories, doneStatus]);

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
      setCalendarRightWidth(inboxState.preferences.calendarRightWidth ?? 320);
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
            />
          </div>
        </div>
      ) : isInboxView ? (
        <>
          {isCalendarView ? (
            <div className="flex-1 bg-background flex flex-col h-full min-w-0 overflow-hidden">
              <div ref={calendarContainerRef} className="flex h-full min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 border-r border-panel-border flex flex-col">
                  <div className="px-4 py-4 border-b border-panel-border">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-foreground">Calendar</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <button
                          type="button"
                          className="rounded-md border border-panel-border px-2 py-1 text-xs hover:bg-hover-overlay"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                            )
                          }
                        >
                          Prev
                        </button>
                        <span>{format(calendarMonth, "MMMM yyyy")}</span>
                        <button
                          type="button"
                          className="rounded-md border border-panel-border px-2 py-1 text-xs hover:bg-hover-overlay"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                            )
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 border-b border-panel-border bg-card text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div
                        key={day}
                        className="px-3 py-2 border-r border-panel-border last:border-r-0"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="grid min-h-full grid-cols-7 auto-rows-fr">
                      {calendarDays.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayStories = storiesByDay[key] || [];
                        const dayIndex = day.getDay();
                        const isWeekend = dayIndex === 0 || dayIndex === 6;
                        const weekendStyle = isWeekend
                          ? { backgroundColor: "rgba(0, 0, 0, 0.08)" }
                          : undefined;
                        return (
                          <div
                            key={key}
                            style={weekendStyle}
                            className={`border-r border-b border-panel-border p-2 ${
                              isSameMonth(day, new Date()) ? "bg-background" : "bg-card/60"
                            }`}
                          >
                            <div
                              className={`mb-2 text-xs font-semibold ${
                                isSameDay(day, new Date())
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{format(day, "d")}</span>
                                {completedStoriesByDay[key]?.length ? (
                                  <button
                                    type="button"
                                    className="text-[11px] text-emerald-500 hover:text-emerald-400"
                                    onClick={() => setSelectedCalendarDay(day)}
                                    title="View completed stories"
                                  >
                                    ✓
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {dayStories.slice(0, 3).map((story) => (
                                <button
                                  key={story.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 truncate rounded-md border border-panel-border bg-card px-2 py-1 text-left text-xs text-foreground hover:bg-hover-overlay"
                                  onClick={() => setSelectedStoryId(story.id)}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor:
                                        epics.find((epic) => epic.id === story.epicId)?.color ??
                                        "hsl(215, 16%, 47%)",
                                    }}
                                  />
                                  <span className="truncate min-w-0">{story.title}</span>
                                </button>
                              ))}
                              {dayStories.length > 3 ? (
                                <div className="text-xs text-muted-foreground">
                                  +{dayStories.length - 3} more
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div
                  className="w-1 cursor-col-resize bg-transparent hover:bg-border"
                  onMouseDown={() => setIsResizingCalendarRight(true)}
                  title="Resize calendar details pane"
                />
                <div
                  style={{ width: `${calendarRightWidth}px` }}
                  className="shrink-0 min-w-[18rem] border-l border-panel-border bg-card/80 p-4 flex flex-col gap-4 overflow-y-auto"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">
                      Today's due stories
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {todayDueTasks.length} {todayDueTasks.length === 1 ? "story" : "stories"}
                    </span>
                  </div>
                  <div className="flex-1 space-y-3">
                    {todayDueTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No stories due today.</p>
                    ) : (
                      todayDueTasks.map((story) => {
                        const epic = epics.find((e) => e.id === story.epicId);
                        return (
                          <button
                            key={story.id}
                            type="button"
                            onClick={() => setSelectedStoryId(story.id)}
                            className={`w-full rounded-lg border px-3 py-3 text-left transition hover:bg-hover-overlay ${
                              selectedStoryId === story.id
                                ? "border-primary/70 bg-primary/10"
                                : "border-panel-border bg-card"
                            }`}
                          >
                            <div className="text-sm font-medium text-foreground">
                              {story.title}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{epic?.name ?? "Backlog"}</span>
                              <span>{format(getEffectiveDueDate(story), "MMM d")}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-panel-border pt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">
                        Story preview
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selectedStory ? "Selected" : "None"}
                      </span>
                    </div>
                    {selectedStory ? (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                epics.find((epic) => epic.id === selectedStory.epicId)?.color ??
                                "hsl(215, 16%, 47%)",
                            }}
                          />
                          <span className="font-semibold text-foreground truncate">
                            {selectedStory.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {epics.find((epic) => epic.id === selectedStory.epicId)?.name ??
                              "No epic"}
                          </span>
                          <span>{format(getEffectiveDueDate(selectedStory), "MMM d")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedStory.description
                            ? selectedStory.description
                                .replace(/<[^>]+>/g, "")
                                .replace(/\s+/g, " ")
                                .trim()
                            : "No description"}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Due {format(getEffectiveDueDate(selectedStory), "MMM d")}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Click a story to preview details.
                      </p>
                    )}
                  </div>
                  <div className="border-t border-panel-border pt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">
                        Completed stories
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selectedCalendarDay
                          ? format(selectedCalendarDay, "MMM d")
                          : "Select a day"}
                      </span>
                    </div>
                    {selectedCalendarDay ? (
                      <div className="mt-3 space-y-2">
                        {(completedStoriesByDay[
                          format(selectedCalendarDay, "yyyy-MM-dd")
                        ] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No completed stories on this day.
                          </p>
                        ) : (
                          (completedStoriesByDay[
                            format(selectedCalendarDay, "yyyy-MM-dd")
                          ] ?? []).map((story) => (
                            <button
                              key={story.id}
                              type="button"
                              onClick={() => setSelectedStoryId(story.id)}
                              className="w-full rounded-lg border border-panel-border bg-card px-3 py-2 text-left text-xs text-foreground hover:bg-hover-overlay"
                            >
                              {story.title}
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Click the check icon on a day to view completions.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
      ) : activeView === "epics" ? (
        <div className="flex-1 bg-background flex flex-col h-full min-w-0">
          <div className="px-6 py-4 border-b border-panel-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Manage</p>
                <h2 className="text-xl font-semibold text-foreground">Epics</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                  onClick={() => setIsCreateEpicOpen(true)}
                >
                  <span className="text-base leading-none">+</span>
                  New Epic
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-panel-border px-3 text-sm font-medium text-foreground hover:bg-hover-overlay"
                  onClick={() => setShowArchived((prev) => !prev)}
                >
                  {showArchived ? "Hide archived" : "Show archived"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setActiveView("week")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Inbox
            </button>
            <div className="rounded-lg border border-panel-border bg-card">
              <div className="grid grid-cols-[1.2fr,0.6fr,2fr,0.5fr,0.5fr] gap-3 border-b border-panel-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Name</span>
                <span>Key</span>
                <span>Description</span>
                <span className="text-right">Stories</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-panel-border">
                {activeEpics.map((epic) => (
                  <div
                    key={epic.id}
                    className="grid grid-cols-[1.2fr,0.6fr,2fr,0.5fr,0.5fr] gap-3 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2 text-foreground">
                      <button
                        type="button"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: epic.color }}
                        onClick={() => {
                          setEditingEpic(epic);
                          setIsEditEpicOpen(true);
                        }}
                        title="Change epic color"
                      />
                      {editingField?.id === epic.id && editingField.field === "name" ? (
                        <input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onBlur={saveEditField}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              saveEditField();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelEditField();
                            }
                          }}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                          placeholder="Epic name"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="cursor-text font-medium text-left"
                          onClick={() => startEditField(epic, "name")}
                        >
                          {epic.name}
                        </button>
                      )}
                    </div>
                    {editingField?.id === epic.id && editingField.field === "key" ? (
                      <input
                        value={editValue}
                        onChange={(event) => {
                          const sanitized = event.target.value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .toUpperCase();
                          setEditValue(sanitized.slice(0, 3));
                        }}
                        onBlur={saveEditField}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            saveEditField();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelEditField();
                          }
                        }}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                        placeholder="KEY"
                        maxLength={3}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className="cursor-text text-left text-muted-foreground"
                        onClick={() => startEditField(epic, "key")}
                      >
                        {epic.key}
                      </button>
                    )}
                    {editingField?.id === epic.id && editingField.field === "description" ? (
                      <textarea
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                        onBlur={saveEditField}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelEditField();
                          }
                        }}
                        className="min-h-[2.5rem] w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                        placeholder="Description"
                        rows={2}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className="cursor-text text-left text-muted-foreground line-clamp-2"
                        onClick={() => startEditField(epic, "description")}
                      >
                        {epic.description || "—"}
                      </button>
                    )}
                    <span className="text-right text-muted-foreground">
                      {storyCounts[epic.id] || 0}
                    </span>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover-overlay hover:text-foreground"
                        onClick={() => handleArchiveEpic(epic.id)}
                        title="Archive epic"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {activeEpics.length === 0 && (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No epics yet. Create your first epic to get started.
                  </div>
                )}
              </div>
            </div>
            {showArchived && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Archived epics</span>
                  <span>{archivedEpics.length}</span>
                </div>
                <div className="space-y-2 rounded-lg border border-panel-border bg-card/80 p-3">
                  {archivedEpics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No archived epics.</p>
                  ) : (
                    archivedEpics.map((epic) => (
                      <div
                        key={epic.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-sm text-foreground hover:border-panel-border hover:bg-hover-overlay"
                      >
                        <div>
                          <p className="font-medium">{epic.name}</p>
                          <p className="text-xs text-muted-foreground">{epic.key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-panel-border px-3 text-xs font-medium text-primary hover:bg-primary/10"
                            onClick={() => handleRestoreEpic(epic.id)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover-overlay hover:text-foreground"
                            onClick={() => handleArchiveEpic(epic.id)}
                            title="Archive epic again"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
                  Epics List
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
                selectedStoryId={selectedStoryId}
                onSelectStory={setSelectedStoryId}
                onCreateStory={handleQuickAddStory}
                onUpdateStory={handleUpdateStory}
                onDeleteStory={handleDeleteStory}
                onRestoreStory={handleRestoreStory}
                onPermanentDelete={handlePermanentDelete}
                onEmptyTrash={handleEmptyTrash}
                viewTitle={getViewTitle()}
                activeView={activeView}
                dateMode={dateMode}
                showDueTodayToggle={activeView === "week"}
                isDueTodayActive={showDueTodayOnly}
                onToggleDueToday={() => {
                  setShowDueTodayOnly((prev) => {
                    const next = !prev;
                    if (next) setShowDueThisWeekOnly(false);
                    return next;
                  });
                }}
                showDueWeekToggle={activeView === "week"}
                isDueWeekActive={showDueThisWeekOnly}
                onToggleDueWeek={() => {
                  setShowDueThisWeekOnly((prev) => {
                    const next = !prev;
                    if (next) setShowDueTodayOnly(false);
                    return next;
                  });
                }}
                onClearDueFilters={() => {
                  setShowDueTodayOnly(false);
                  setShowDueThisWeekOnly(false);
                }}
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

      <CreateEpicDialog
        open={isCreateEpicOpen}
        onOpenChange={(open) => {
          setIsCreateEpicOpen(open);
          if (!open && pendingStoryAfterEpic) {
            setPendingStoryAfterEpic(false);
          }
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
      <CreateStoryDialog
        open={isCreateStoryOpen}
        onOpenChange={(open) => {
          setIsCreateStoryOpen(open);
          if (!open) setPendingStoryTitle("");
        }}
        epics={activeEpics}
        selectedEpicId={selectedEpicId || undefined}
        initialTitle={pendingStoryTitle}
        statusOptions={statusOptions}
        defaultStatus={defaultStatus}
        dateMode={dateMode}
        isYearly={activeView === "yearly"}
        typeOfWorkOptions={typeOfWorkOptions}
        onAddTypeOfWork={handleAddTypeOfWork}
        onRequestCreateEpic={() => {
          setIsCreateStoryOpen(false);
          setIsCreateEpicOpen(true);
          setPendingStoryAfterEpic(true);
        }}
        onCreateStory={handleCreateStory}
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
                {story.status === doneStatus
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
