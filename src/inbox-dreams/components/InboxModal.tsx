import { RefObject } from "react";
import { Dialog, DialogContent } from "@inbox/components/ui/dialog";
import InboxPage from "../pages/InboxPage";
import type { Epic, Story } from "@inbox/types";
import { clampPaneWidth } from "../lib/utils/pane";

type InboxModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalActiveView: string;
  setModalActiveView: (view: string) => void;
  epics: Epic[];
  activeEpics: Epic[];
  storyCounts: Record<string, number>;
  selectedEpicId: string | null;
  onSelectEpic: (epicId: string | null) => void;
  onCreateEpic: () => void;
  onRenameEpic: (epicId: string) => void;
  onDeleteEpic: (epicId: string) => void;
  epicsPaneWidth: number;
  isModalEpicsPaneCollapsed: boolean;
  onToggleModalEpicsPane: () => void;
  onStartResizeEpicsPane: () => void;
  onStartResizeListPane: () => void;
  modalListWidth: number;
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
  dateMode: "day" | "month";
  dueFilter: "all" | "today" | "next-week";
  onDueFilterChange: (value: "all" | "today" | "next-week") => void;
  canRenameEpic: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCompletedDateChange: (storyId: string, completedAt?: Date) => void;
  onAddTypeOfWork: (value: string) => void;
  onOpenMeetings: () => void;
  detailContainerRef: RefObject<HTMLDivElement>;
};

const InboxModal = ({
  open,
  onOpenChange,
  modalActiveView,
  setModalActiveView,
  epics,
  activeEpics,
  storyCounts,
  selectedEpicId,
  onSelectEpic,
  onCreateEpic,
  onRenameEpic,
  onDeleteEpic,
  epicsPaneWidth,
  isModalEpicsPaneCollapsed,
  onToggleModalEpicsPane,
  onStartResizeEpicsPane,
  onStartResizeListPane,
  modalListWidth,
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
  dateMode,
  dueFilter,
  onDueFilterChange,
  canRenameEpic,
  searchQuery,
  onSearchChange,
  onCompletedDateChange,
  onAddTypeOfWork,
  onOpenMeetings,
  detailContainerRef,
}: InboxModalProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(openState) => {
        onOpenChange(openState);
        if (openState) setModalActiveView("week");
      }}
    >
      <DialogContent className="max-w-[98vw] h-[90vh] w-[1700px] overflow-hidden p-0">
        <InboxPage
          activeView={modalActiveView}
          onViewChange={setModalActiveView}
          dateMode={dateMode}
          detailContainerRef={detailContainerRef}
          epics={epics}
          activeEpics={activeEpics}
          selectedEpicId={selectedEpicId}
          storyCounts={storyCounts}
          isEpicsPaneCollapsed={isModalEpicsPaneCollapsed}
          epicsPaneWidth={clampPaneWidth(epicsPaneWidth)}
          effectiveListWidth={modalListWidth}
          onToggleEpicsPane={onToggleModalEpicsPane}
          onStartResizeEpicsPane={onStartResizeEpicsPane}
          onStartResizeListPane={onStartResizeListPane}
          onSelectEpic={onSelectEpic}
          onCreateEpic={onCreateEpic}
          onRenameEpic={onRenameEpic}
          onDeleteEpic={onDeleteEpic}
          filteredStories={filteredStories}
          statusOptions={statusOptions}
          doneStatus={doneStatus}
          defaultStatus={defaultStatus}
          savedStatusIndex={savedStatusIndex}
          statusFilters={statusFilters}
          typeOfWorkFilters={typeOfWorkFilters}
          statusFilterOptions={statusFilterOptions}
          typeFilterOptions={typeFilterOptions}
          typeOfWorkOptions={typeOfWorkOptions}
          onStatusFiltersChange={onStatusFiltersChange}
          onTypeOfWorkFiltersChange={onTypeOfWorkFiltersChange}
          selectedStory={selectedStory}
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          onCreateStory={onCreateStory}
          onUpdateStory={onUpdateStory}
          onDeleteStory={onDeleteStory}
          onRestoreStory={onRestoreStory}
          onPermanentDelete={onPermanentDelete}
          onEmptyTrash={onEmptyTrash}
          viewTitle={viewTitle}
          dueFilter={dueFilter}
          onDueFilterChange={onDueFilterChange}
          canRenameEpic={canRenameEpic}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onCompletedDateChange={onCompletedDateChange}
          onAddTypeOfWork={onAddTypeOfWork}
          onOpenMeetings={onOpenMeetings}
        />
      </DialogContent>
    </Dialog>
  );
};

export default InboxModal;
