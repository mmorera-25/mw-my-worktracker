import { RefObject } from "react";
import { ListSidebar } from "@inbox/components/ListSidebar";
import { StoryList } from "@inbox/components/StoryList";
import { StoryDetail } from "@inbox/components/StoryDetail";
import { EmptyState } from "@inbox/components/EmptyState";
import type { Epic, Story } from "@inbox/types";

type InboxPageProps = {
  activeView: string;
  onViewChange: (view: string) => void;
  dateMode: "day" | "month";
  detailContainerRef: RefObject<HTMLDivElement>;
  epics: Epic[];
  activeEpics: Epic[];
  selectedEpicId: string | null;
  storyCounts: Record<string, number>;
  isEpicsPaneCollapsed: boolean;
  epicsPaneWidth: number;
  effectiveListWidth: number;
  onToggleEpicsPane: () => void;
  onStartResizeEpicsPane: () => void;
  onStartResizeListPane: () => void;
  onSelectEpic: (epicId: string | null) => void;
  onCreateEpic: () => void;
  onRenameEpic: (epicId: string) => void;
  onDeleteEpic: (epicId: string) => void;
  filteredStories: Story[];
  statusOptions: string[];
  doneStatus: string;
  defaultStatus: string;
  savedStatusIndex?: number;
  statusFilters: string[];
  typeOfWorkFilters: string[];
  statusFilterOptions: string[];
  typeFilterOptions: string[];
  typeOfWorkOptions: string[];
  onStatusFiltersChange: (values: string[]) => void;
  onTypeOfWorkFiltersChange: (values: string[]) => void;
  selectedStory: Story | undefined;
  selectedStoryId: string | null;
  onSelectStory: (id: string | null) => void;
  onCreateStory: (title: string) => void;
  onUpdateStory: (story: Story) => void;
  onDeleteStory: (id: string) => void;
  onRestoreStory: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyTrash: () => void;
  viewTitle: string;
  dueFilter: "all" | "today" | "next-week";
  onDueFilterChange: (value: "all" | "today" | "next-week") => void;
  canRenameEpic: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCompletedDateChange: (storyId: string, completedAt?: Date) => void;
  onAddTypeOfWork: (value: string) => void;
  onOpenMeetings: () => void;
};

const InboxPage = ({
  activeView,
  dateMode,
  detailContainerRef,
  epics,
  activeEpics,
  selectedEpicId,
  storyCounts,
  isEpicsPaneCollapsed,
  epicsPaneWidth,
  effectiveListWidth,
  onToggleEpicsPane,
  onStartResizeEpicsPane,
  onStartResizeListPane,
  onSelectEpic,
  onViewChange,
  onCreateEpic,
  onRenameEpic,
  onDeleteEpic,
  filteredStories,
  statusOptions,
  doneStatus,
  defaultStatus,
  savedStatusIndex,
  statusFilters,
  typeOfWorkFilters,
  statusFilterOptions,
  typeFilterOptions,
  typeOfWorkOptions,
  onStatusFiltersChange,
  onTypeOfWorkFiltersChange,
  selectedStory,
  selectedStoryId,
  onSelectStory,
  onCreateStory,
  onUpdateStory,
  onDeleteStory,
  onRestoreStory,
  onPermanentDelete,
  onEmptyTrash,
  viewTitle,
  dueFilter,
  onDueFilterChange,
  canRenameEpic,
  searchQuery,
  onSearchChange,
  onCompletedDateChange,
  onAddTypeOfWork,
  onOpenMeetings,
}: InboxPageProps) => {
  return (
    <div ref={detailContainerRef} className="flex h-full flex-1 min-w-0">
      <div className="relative flex h-full">
        <button
          type="button"
          className="flex h-full w-6 flex-col items-center justify-start border border-panel-border bg-card/70 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-all hover:bg-card"
          onClick={onToggleEpicsPane}
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
                onSelectEpic={onSelectEpic}
                onCreateEpic={onCreateEpic}
                storyCounts={storyCounts}
                activeView={activeView}
                onViewChange={onViewChange}
                width={epicsPaneWidth}
                onRenameEpic={onRenameEpic}
                onDeleteEpic={onDeleteEpic}
              />
              <div
                className="w-1 cursor-col-resize bg-transparent hover:bg-border"
                onMouseDown={onStartResizeEpicsPane}
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
          savedStatusIndex={savedStatusIndex}
          statusFilters={statusFilters}
          typeOfWorkFilters={typeOfWorkFilters}
          onStatusFiltersChange={onStatusFiltersChange}
          onTypeOfWorkFiltersChange={onTypeOfWorkFiltersChange}
          typeOfWorkOptions={typeOfWorkOptions}
          statusFilterOptions={statusFilterOptions}
          typeFilterOptions={typeFilterOptions}
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          onCreateStory={onCreateStory}
          onUpdateStory={onUpdateStory}
          onDeleteStory={onDeleteStory}
          onRestoreStory={onRestoreStory}
          onPermanentDelete={onPermanentDelete}
          onEmptyTrash={onEmptyTrash}
          viewTitle={viewTitle}
          activeView={activeView}
          dateMode={dateMode}
          dueFilter={dueFilter}
          onDueFilterChange={onDueFilterChange}
          canRenameEpic={canRenameEpic}
          onRenameEpic={onRenameEpic}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onCompletedDateChange={onCompletedDateChange}
        />
      </div>
      <div
        className="w-1 cursor-col-resize bg-transparent hover:bg-border"
        onMouseDown={onStartResizeListPane}
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
            onAddTypeOfWork={onAddTypeOfWork}
            onUpdateStory={onUpdateStory}
            onOpenMeetings={onOpenMeetings}
            onDeleteStory={onDeleteStory}
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
  );
};

export default InboxPage;
