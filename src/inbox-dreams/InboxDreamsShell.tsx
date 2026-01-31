import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { IconSidebar } from "@inbox/components/IconSidebar";
import { ListSidebar } from "@inbox/components/ListSidebar";
import { StoryList } from "@inbox/components/StoryList";
import { StoryDetail } from "@inbox/components/StoryDetail";
import { EmptyState } from "@inbox/components/EmptyState";
import { CreateEpicDialog } from "@inbox/components/CreateEpicDialog";
import type { Epic, Story } from "@inbox/types";
import KanbanPage from "./pages/KanbanPage";
import InboxPage from "./pages/InboxPage";
import SettingsPage from "./pages/SettingsPage";
import NotesPage from "./pages/NotesPage";
import MeetingsPage from "./pages/MeetingsPage";
import OKRsPage from "./pages/OKRsPage";
import ReportingPage from "./pages/ReportingPage";
import { loadDb, persistDb, type DbContext } from "../lib/storage/dbManager";
import { loadInboxState, saveInboxState } from "@inbox/data/inboxRepository";
import { addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { Archive, ArrowLeft, Inbox, Trash2, RotateCcw } from "lucide-react";
import { useWorkflowConfig } from "./hooks/useWorkflowConfig";
import { useInboxFilters } from "./hooks/useInboxFilters";
import {
  useInboxData,
  NO_EPIC_ID,
  NO_EPIC_NAME,
  NO_EPIC_KEY,
  DOC_EPIC_ID,
  DOC_EPIC_NAME,
  DOC_EPIC_LEGACY_NAME,
} from "./hooks/useInboxData";
import InboxModal from "./components/InboxModal";
import { clampPaneWidth } from "./lib/utils/pane";
import { getEffectiveDueDate } from "./lib/inboxUtils";

type InboxDreamsShellProps = {
  user: FirebaseUser;
};

const INBOX_LIST_WIDTH = 420;
const EPICS_BAR_WIDTH = 24;
const EPICS_RESIZER_WIDTH = 4;
const EPICS_SEPARATOR_WIDTH = 1;
const LIST_MIN_WIDTH = 320;
const LIST_MAX_RATIO = 0.7;
const InboxDreamsShell = ({ user }: InboxDreamsShellProps) => {
  const [activeView, setActiveView] = useState("week");
  const [isCreateEpicOpen, setIsCreateEpicOpen] = useState(false);
  const [isEditEpicOpen, setIsEditEpicOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
  const [modalActiveView, setModalActiveView] = useState("week");
  const [isModalEpicsPaneCollapsed, setIsModalEpicsPaneCollapsed] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [focusedOkr, setFocusedOkr] = useState<string | null>(null);
  const {
    workflow,
    setWorkflowConfig,
    reloadWorkflow,
    doneStatus,
    defaultStatus,
    kanbanBuckets,
  } = useWorkflowConfig();
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState<string[]>([
    "Configuration",
    "Ask question in a Meeting",
    "Document",
    "Send Email",
    "Aligment Required",
    "Waiting for Answer",
  ]);

  const statusOptions = useMemo(
    () => workflow.columns.filter((column) => column !== "Doing"),
    [workflow.columns]
  );


  const {
    epics,
    stories,
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
  } = useInboxData({ doneStatus, defaultStatus, kanbanBuckets });
  const {
    statusFilters,
    setStatusFilters,
    typeOfWorkFilters,
    setTypeOfWorkFilters,
    dueFilter,
    setDueFilter,
    searchQuery,
    setSearchQuery,
    allStatusFilterOptions,
    allTypeFilterOptions,
    statusUsageCounts,
    typeUsageCounts,
    getFilteredStories,
    getStoryCounts,
  } = useInboxFilters({
    stories,
    statusOptions,
    doneStatus,
    typeOfWorkOptions,
  });
  const [editingField, setEditingField] = useState<{
    id: string;
    field: "name" | "key" | "description";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [listPaneWidth, setListPaneWidth] = useState(INBOX_LIST_WIDTH);
  const [isResizingListPane, setIsResizingListPane] = useState(false);
  const [epicsPaneWidth, setEpicsPaneWidth] = useState(208);
  const [isResizingEpicsPane, setIsResizingEpicsPane] = useState(false);
  const [isEpicsPaneCollapsed, setIsEpicsPaneCollapsed] = useState(false);
  const [detailContainerWidth, setDetailContainerWidth] = useState(0);
  const detailContainerRef = useRef<HTMLDivElement | null>(null);
  const dbContextRef = useRef<DbContext | null>(null);
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
      const inboxState = loadInboxState(ctx.db);
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

  const normalizedStories = stories;

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

  const filteredStories = useMemo(
    () => getFilteredStories(activeView, selectedEpicId),
    [getFilteredStories, activeView, selectedEpicId]
  );

  const modalFilteredStories = useMemo(
    () => getFilteredStories(modalActiveView, selectedEpicId),
    [getFilteredStories, modalActiveView, selectedEpicId]
  );

  const storyCounts = useMemo(
    () => getStoryCounts(activeView),
    [getStoryCounts, activeView]
  );

  const modalStoryCounts = useMemo(
    () => getStoryCounts(modalActiveView),
    [getStoryCounts, modalActiveView]
  );


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
      if (ctx.mode !== "fs") return;
      await reloadWorkflow();
      await reloadInbox();
      const inboxState = loadInboxState(ctx.db);
      setShowArchived(Boolean(inboxState.preferences.showArchived));
      if (Array.isArray(inboxState.preferences.typeOfWorkOptions)) {
        setTypeOfWorkOptions(inboxState.preferences.typeOfWorkOptions);
      }
      setListPaneWidth(inboxState.preferences.listPaneWidth ?? INBOX_LIST_WIDTH);
      setEpicsPaneWidth(clampPaneWidth(inboxState.preferences.epicsPaneWidth ?? 208));
      setIsEpicsPaneCollapsed(Boolean(inboxState.preferences.epicsPaneCollapsed));
    };
    refresh();
  }, []);

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

  const startEditField = useCallback((epic: Epic, field: "name" | "key" | "description") => {
    if (isSystemEpic(epic)) return;
    setEditingField({ id: epic.id, field });
    if (field === "name") setEditValue(epic.name);
    if (field === "key") setEditValue(epic.key);
    if (field === "description") setEditValue(epic.description);
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
      await reloadInbox();
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
      await reloadWorkflow();
      await reloadInbox();
      const inboxState = loadInboxState(ctx.db);
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

  const renderInboxPage = () => (
    <InboxPage
      activeView={activeView}
      onViewChange={handleViewChange}
      dateMode={dateMode}
      detailContainerRef={detailContainerRef}
      epics={epics}
      activeEpics={activeEpics}
      selectedEpicId={selectedEpicId}
      storyCounts={storyCounts}
      isEpicsPaneCollapsed={isEpicsPaneCollapsed}
      epicsPaneWidth={clampPaneWidth(epicsPaneWidth)}
      effectiveListWidth={effectiveListWidth}
      onToggleEpicsPane={() => setIsEpicsPaneCollapsed((prev) => !prev)}
      onStartResizeEpicsPane={() => setIsResizingEpicsPane(true)}
      onStartResizeListPane={() => setIsResizingListPane(true)}
      onSelectEpic={handleSelectEpic}
      onCreateEpic={() => setIsCreateEpicOpen(true)}
      onRenameEpic={handleRenameEpicFromSidebar}
      onDeleteEpic={handleArchiveEpic}
      filteredStories={filteredStories}
      statusOptions={statusOptions}
      doneStatus={doneStatus}
      defaultStatus={defaultStatus}
      savedStatusIndex={workflow.savedStatusIndex}
      statusFilters={statusFilters}
      typeOfWorkFilters={typeOfWorkFilters}
      statusFilterOptions={allStatusFilterOptions}
      typeFilterOptions={allTypeFilterOptions}
      typeOfWorkOptions={typeOfWorkOptions}
      onStatusFiltersChange={setStatusFilters}
      onTypeOfWorkFiltersChange={setTypeOfWorkFilters}
      selectedStory={selectedStory}
      selectedStoryId={selectedStoryId}
      onSelectStory={setSelectedStoryId}
      onCreateStory={(title) => handleQuickAddStory(title, activeView)}
      onUpdateStory={handleUpdateStory}
      onDeleteStory={handleDeleteStory}
      onRestoreStory={handleRestoreStory}
      onPermanentDelete={handlePermanentDelete}
      onEmptyTrash={handleEmptyTrash}
      viewTitle={getViewTitle()}
      dueFilter={dueFilter}
      onDueFilterChange={setDueFilter}
      canRenameEpic={
        Boolean(selectedEpicId) &&
        selectedEpicId !== "no-epic-assigned" &&
        selectedEpicId !== "week" &&
        getViewTitle() !== "Inbox" &&
        activeView === "week"
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onCompletedDateChange={(storyId, completedAt) => {
        const target = stories.find((s) => s.id === storyId);
        if (!target) return;
        handleUpdateStory({ ...target, completedAt });
      }}
      onAddTypeOfWork={handleAddTypeOfWork}
      onOpenMeetings={() => setActiveView("oneonone")}
    />
  );

  const renderKanbanPage = () => (
    <KanbanPage
      stories={filteredStories}
      epics={epics}
      statusOrder={workflow.columns}
      bucketMap={kanbanBuckets}
      selectedStoryId={selectedStoryId}
      selectedStory={selectedStory}
      statusFilters={statusFilters}
      typeOfWorkFilters={typeOfWorkFilters}
      statusFilterOptions={allStatusFilterOptions}
      typeFilterOptions={allTypeFilterOptions}
      dueFilter={dueFilter}
      onSelectStory={setSelectedStoryId}
      onMoveStory={handleMoveStoryToBucket}
      onStatusFiltersChange={setStatusFilters}
      onTypeOfWorkFiltersChange={setTypeOfWorkFilters}
      onDueFilterChange={setDueFilter}
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
  );

  const renderMainContent = () => {
    if (requiresStorageSetup) {
      return (
        <SettingsPage
          workflow={workflow}
          onUpdateWorkflow={setWorkflowConfig}
          onStorageReady={handleStorageReady}
          requiresStorageSetup={requiresStorageSetup}
          typeOfWorkOptions={typeOfWorkOptions}
          onPersistTypeOfWorkOptions={persistTypeOfWorkOptions}
          statusUsageCounts={statusUsageCounts}
          typeUsageCounts={typeUsageCounts}
        />
      );
    }

    if (isInboxView) {
      return isKanbanView ? renderKanbanPage() : renderInboxPage();
    }

    if (activeView === "notifications") {
      return (
        <NotificationCenter
          notifications={upcomingNotifications}
          doneStatus={doneStatus}
        />
      );
    }

    if (activeView === "settings") {
      return (
        <SettingsPage
          workflow={workflow}
          onUpdateWorkflow={setWorkflowConfig}
          onStorageReady={handleStorageReady}
          requiresStorageSetup={requiresStorageSetup}
          typeOfWorkOptions={typeOfWorkOptions}
          onPersistTypeOfWorkOptions={persistTypeOfWorkOptions}
          statusUsageCounts={statusUsageCounts}
          typeUsageCounts={typeUsageCounts}
        />
      );
    }

    if (activeView === "notes") {
      return <NotesPage lanes={workflow.columns} swimlanes={workflow.swimlanes} />;
    }

    if (activeView === "oneonone") {
      return <MeetingsPage userFirstName={firstName} />;
    }

    if (activeView === "okrs") {
      return <OKRsPage focusId={focusedOkr} />;
    }

    if (activeView === "reporting") {
      return <ReportingPage />;
    }

    return renderInboxPage();
  };

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

      {renderMainContent()}

      <InboxModal
        open={isInboxModalOpen}
        onOpenChange={setIsInboxModalOpen}
        modalActiveView={modalActiveView}
        setModalActiveView={setModalActiveView}
        epics={epics}
        activeEpics={activeEpics}
        storyCounts={modalStoryCounts}
        selectedEpicId={selectedEpicId}
        onSelectEpic={handleSelectEpic}
        onCreateEpic={() => setIsCreateEpicOpen(true)}
        onRenameEpic={handleRenameEpicFromSidebar}
        onDeleteEpic={handleArchiveEpic}
        epicsPaneWidth={epicsPaneWidth}
        isModalEpicsPaneCollapsed={isModalEpicsPaneCollapsed}
        onToggleModalEpicsPane={() => setIsModalEpicsPaneCollapsed((prev) => !prev)}
        onStartResizeEpicsPane={() => setIsResizingEpicsPane(true)}
        onStartResizeListPane={() => setIsResizingListPane(true)}
        modalListWidth={modalListWidth}
        filteredStories={modalFilteredStories}
        statusOptions={statusOptions}
        doneStatus={doneStatus}
        defaultStatus={defaultStatus}
        savedStatusIndex={workflow.savedStatusIndex}
        statusFilters={statusFilters}
        typeOfWorkFilters={typeOfWorkFilters}
        statusFilterOptions={allStatusFilterOptions}
        typeFilterOptions={allTypeFilterOptions}
        typeOfWorkOptions={typeOfWorkOptions}
        onStatusFiltersChange={setStatusFilters}
        onTypeOfWorkFiltersChange={setTypeOfWorkFilters}
        selectedStory={selectedStory}
        selectedStoryId={selectedStoryId}
        onSelectStory={setSelectedStoryId}
        onCreateStory={(title) => handleQuickAddStory(title, modalActiveView)}
        onUpdateStory={handleUpdateStory}
        onDeleteStory={handleDeleteStory}
        onRestoreStory={handleRestoreStory}
        onPermanentDelete={handlePermanentDelete}
        onEmptyTrash={handleEmptyTrash}
        viewTitle={
          modalActiveView === "trash"
            ? "Trash"
            : modalActiveView === "yearly"
            ? "Yearly Inbox"
            : modalActiveView === "search"
            ? "Search"
            : "Inbox"
        }
        dateMode={modalDateMode}
        dueFilter={dueFilter}
        onDueFilterChange={setDueFilter}
        canRenameEpic={
          Boolean(selectedEpicId) &&
          selectedEpicId !== "no-epic-assigned" &&
          selectedEpicId !== "week" &&
          modalActiveView === "week"
        }
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCompletedDateChange={(storyId, completedAt) => {
          const target = stories.find((s) => s.id === storyId);
          if (!target) return;
          handleUpdateStory({ ...target, completedAt });
        }}
        onAddTypeOfWork={handleAddTypeOfWork}
        onOpenMeetings={() => setActiveView("oneonone")}
        detailContainerRef={detailContainerRef}
      />

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
