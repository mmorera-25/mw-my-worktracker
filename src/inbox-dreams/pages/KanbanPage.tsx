import { StoryDetail } from "@inbox/components/StoryDetail";
import StoryKanban from "@inbox/components/StoryKanban";
import { EmptyState } from "@inbox/components/EmptyState";
import type { Epic, Story } from "@inbox/types";
import type { KanbanBucket } from "../lib/settings/configRepository";

type KanbanPageProps = {
  stories: Story[];
  epics: Epic[];
  statusOrder: string[];
  bucketMap: Record<string, KanbanBucket>;
  selectedStoryId: string | null;
  selectedStory: Story | undefined;
  statusFilters: string[];
  typeOfWorkFilters: string[];
  statusFilterOptions: string[];
  typeFilterOptions: string[];
  dueFilter: "all" | "today" | "next-week";
  onSelectStory: (id: string | null) => void;
  onMoveStory: (storyId: string, targetBucket: KanbanBucket) => void;
  onStatusFiltersChange: (values: string[]) => void;
  onTypeOfWorkFiltersChange: (values: string[]) => void;
  onDueFilterChange: (value: "all" | "today" | "next-week") => void;
  statusOptions: string[];
  doneStatus: string;
  defaultStatus: string;
  dateMode: "day" | "month";
  typeOfWorkOptions: string[];
  onAddTypeOfWork: (value: string) => void;
  onUpdateStory: (story: Story) => void;
  onOpenMeetings: () => void;
  onDeleteStory: (id: string) => void;
};

const KanbanPage = ({
  stories,
  epics,
  statusOrder,
  bucketMap,
  selectedStoryId,
  selectedStory,
  statusFilters,
  typeOfWorkFilters,
  statusFilterOptions,
  typeFilterOptions,
  dueFilter,
  onSelectStory,
  onMoveStory,
  onStatusFiltersChange,
  onTypeOfWorkFiltersChange,
  onDueFilterChange,
  statusOptions,
  doneStatus,
  defaultStatus,
  dateMode,
  typeOfWorkOptions,
  onAddTypeOfWork,
  onUpdateStory,
  onOpenMeetings,
  onDeleteStory,
}: KanbanPageProps) => {
  return (
    <div className="flex-1 bg-background flex flex-col h-full min-w-0 overflow-hidden">
      <div className="flex h-full min-h-0">
        <div className="flex-1 overflow-hidden p-4">
          <StoryKanban
            stories={stories}
            epics={epics}
            statusOrder={statusOrder}
            bucketMap={bucketMap}
            selectedStoryId={selectedStoryId}
            onSelectStory={onSelectStory}
            onMoveStory={onMoveStory}
            statusFilters={statusFilters}
            typeOfWorkFilters={typeOfWorkFilters}
            statusFilterOptions={statusFilterOptions}
            typeFilterOptions={typeFilterOptions}
            dueFilter={dueFilter}
            onStatusFiltersChange={onStatusFiltersChange}
            onTypeOfWorkFiltersChange={onTypeOfWorkFiltersChange}
            onDueFilterChange={onDueFilterChange}
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
    </div>
  );
};

export default KanbanPage;
