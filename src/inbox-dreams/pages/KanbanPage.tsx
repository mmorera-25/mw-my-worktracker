import StoryKanban from "@inbox/components/StoryKanban";
import type { Epic, Story } from "@inbox/types";
import type { KanbanBucket } from "../lib/settings/configRepository";

type KanbanPageProps = {
  stories: Story[];
  epics: Epic[];
  bucketMap: Record<string, KanbanBucket>;
  selectedStoryId: string | null;
  statusFilters: string[];
  typeOfWorkFilters: string[];
  statusFilterOptions: string[];
  typeFilterOptions: string[];
  dueFilter: "all" | "today" | "next-week";
  statusOrder: string[];
  onSelectStory: (id: string) => void;
  onStatusFiltersChange: (values: string[]) => void;
  onTypeOfWorkFiltersChange: (values: string[]) => void;
  onDueFilterChange: (value: "all" | "today" | "next-week") => void;
  onSetStoryStatus: (storyId: string, status: string) => void;
};

const KanbanPage = ({
  stories,
  epics,
  bucketMap,
  selectedStoryId,
  statusFilters,
  typeOfWorkFilters,
  statusFilterOptions,
  typeFilterOptions,
  dueFilter,
  statusOrder,
  onSelectStory,
  onStatusFiltersChange,
  onTypeOfWorkFiltersChange,
  onDueFilterChange,
  onSetStoryStatus,
}: KanbanPageProps) => {
  return (
    <div className="flex-1 bg-background flex flex-col h-full min-w-0 overflow-hidden">
      <div className="flex h-full min-h-0">
        <div className="flex-1 overflow-hidden p-4">
          <StoryKanban
            stories={stories}
            epics={epics}
            bucketMap={bucketMap}
            selectedStoryId={selectedStoryId}
            onSelectStory={onSelectStory}
            statusFilters={statusFilters}
            typeOfWorkFilters={typeOfWorkFilters}
            statusFilterOptions={statusFilterOptions}
            typeFilterOptions={typeFilterOptions}
            dueFilter={dueFilter}
            statusOrder={statusOrder}
            onStatusFiltersChange={onStatusFiltersChange}
            onTypeOfWorkFiltersChange={onTypeOfWorkFiltersChange}
            onDueFilterChange={onDueFilterChange}
            onSetStoryStatus={onSetStoryStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default KanbanPage;
