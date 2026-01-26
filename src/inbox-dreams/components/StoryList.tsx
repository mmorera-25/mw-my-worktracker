import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, MoreVertical, Trash2, RotateCcw, ListTodo, Activity, Inbox, CheckCircle, CalendarCheck, XCircle, HelpCircle, Pencil, Search } from "lucide-react";
import { Story, Epic } from "@inbox/types";
import { StoryListItem } from "./StoryListItem";
import { Input } from "@inbox/components/ui/input";
import { Button } from "@inbox/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@inbox/components/ui/dropdown-menu";

interface StoryListProps {
  stories: Story[];
  epics: Epic[];
  statusOptions: string[];
  doneStatus: string;
  defaultStatus: string;
  selectedStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  onCreateStory: (title: string) => void;
  onUpdateStory: (story: Story) => void;
  onDeleteStory: (storyId: string) => void;
  onRestoreStory: (storyId: string) => void;
  onPermanentDelete: (storyId: string) => void;
  onEmptyTrash?: () => void;
  onCompletedDateChange: (storyId: string, completedAt?: Date) => void;
  viewTitle: string;
  activeView: string;
  dateMode?: "day" | "month";
  showDueTodayToggle?: boolean;
  isDueTodayActive?: boolean;
  onToggleDueToday?: () => void;
  showDueWeekToggle?: boolean;
  isDueWeekActive?: boolean;
  onToggleDueWeek?: () => void;
  onClearDueFilters?: () => void;
  canRenameEpic?: boolean;
  onRenameEpic?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

interface DateGroupProps {
  title: string;
  count: number;
  stories: Story[];
  epics: Epic[];
  doneStatus: string;
  defaultStatus: string;
  selectedStoryId: string | null;
  dateMode?: "day" | "month";
  onSelectStory: (storyId: string) => void;
  onUpdateStory: (story: Story) => void;
  onDeleteStory: (storyId: string) => void;
  defaultExpanded?: boolean;
}

function StatusGroup({
  title, 
  count, 
  stories, 
  epics, 
  doneStatus,
  defaultStatus,
  selectedStoryId, 
  dateMode,
  onSelectStory, 
  onUpdateStory,
  onDeleteStory,
  defaultExpanded = true
}: DateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const iconMap: Record<string, React.ReactNode> = {
    Scheduled: <CalendarCheck className="w-4 h-4 text-muted-foreground" />,
    "To Ask": <HelpCircle className="w-4 h-4 text-muted-foreground" />,
    "To Do": <ListTodo className="w-4 h-4 text-muted-foreground" />,
    Doing: <Activity className="w-4 h-4 text-muted-foreground" />,
    Backlog: <Inbox className="w-4 h-4 text-muted-foreground" />,
    Done: <CheckCircle className="w-4 h-4 text-muted-foreground" />,
  };
  const sortedStories = useMemo(() => {
    const priorityOrder: Record<Story["priority"], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return stories.slice().sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [stories]);

  if (stories.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-hover-overlay transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        {iconMap[title] ?? null}
        <span className="font-medium text-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>

      {isExpanded && (
        <div className="space-y-px">
          {sortedStories.map((story) => (
            <StoryListItem
              key={story.id}
              story={story}
              epic={epics.find((e) => e.id === story.epicId)}
              isSelected={selectedStoryId === story.id}
              dateMode={dateMode}
              onClick={() => onSelectStory(story.id)}
              onToggleComplete={() => {
                onUpdateStory({
                  ...story,
                  status: story.status === doneStatus ? defaultStatus : doneStatus
                });
              }}
              onPriorityChange={(priority) =>
                onUpdateStory({
                  ...story,
                  priority,
                })
              }
              onDelete={() => onDeleteStory(story.id)}
              doneStatus={doneStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StoryList({
  stories,
  epics,
  statusOptions,
  doneStatus,
  defaultStatus,
  selectedStoryId,
  onSelectStory,
  onCreateStory,
  onUpdateStory,
  onDeleteStory,
  onRestoreStory,
  onPermanentDelete,
  onEmptyTrash,
  viewTitle,
  activeView,
  dateMode = "day",
  showDueTodayToggle,
  isDueTodayActive,
  onToggleDueToday,
  showDueWeekToggle,
  isDueWeekActive,
  onToggleDueWeek,
  onClearDueFilters,
  canRenameEpic,
  onRenameEpic,
  searchQuery,
  onSearchChange,
}: StoryListProps) {
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const isCompletedView = activeView === 'completed';
  const isTrashView = activeView === 'trash';
  const isSearchView = activeView === "search";

  const groupedStories = useMemo(() => {
    const orderedStatuses = ["To Ask", "To Do", "Doing", "Scheduled", "Backlog", "Done"];
    const remaining = statusOptions.filter((status) => !orderedStatuses.includes(status));
    const groups = [...orderedStatuses, ...remaining].map((status) => ({
      status,
      stories: [] as Story[],
    }));
    const extra: Story[] = [];
    stories.forEach((story) => {
      const idx = groups.findIndex((group) => group.status === story.status);
      if (idx >= 0) {
        groups[idx].stories.push(story);
      } else {
        extra.push(story);
      }
    });
    if (extra.length > 0) {
      groups.push({ status: "Other", stories: extra });
    }
    return groups;
  }, [stories, statusOptions]);

  const handleAddStory = (e: React.KeyboardEvent) => {
    if (isSearchView) return;
    if (e.key === "Enter" && newStoryTitle.trim()) {
      onCreateStory(newStoryTitle.trim());
      setNewStoryTitle("");
    }
  };

  // For completed and trash views, show a simple list
  if (isCompletedView || isTrashView) {
    return (
      <div className="flex-1 bg-background flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-panel-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground">
                {viewTitle}
              </span>
              <span className="text-sm text-muted-foreground">
                ({stories.length})
              </span>
            </div>
            {isTrashView && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={onEmptyTrash}
                disabled={stories.length === 0}
              >
                Empty trash
              </Button>
            )}
          </div>
        </div>

        {/* Story List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {stories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                {isTrashView ? (
                  <>
                    <Trash2 className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-sm">Trash is empty</p>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-sm">No completed stories</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-px">
              {stories.map((story) => (
                <StoryListItem
                  key={story.id}
                  story={story}
                  epic={epics.find((e) => e.id === story.epicId)}
                  isSelected={selectedStoryId === story.id}
                  dateMode={dateMode}
                  onClick={() => onSelectStory(story.id)}
                  onToggleComplete={() => {
                    onUpdateStory({
                      ...story,
                      status: story.status === doneStatus ? defaultStatus : doneStatus
                    });
                  }}
                  onPriorityChange={(priority) =>
                    onUpdateStory({
                      ...story,
                      priority,
                    })
                  }
                  onDelete={() => onDeleteStory(story.id)}
                  onRestore={() => onRestoreStory(story.id)}
                  onPermanentDelete={() => onPermanentDelete(story.id)}
                  isTrashView={isTrashView}
                  isCompletedView={isCompletedView}
                  doneStatus={doneStatus}
                  onCompletedDateChange={(date) => onCompletedDateChange(story.id, date)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-panel-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              {viewTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(isDueTodayActive || isDueWeekActive) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onClearDueFilters}
                title="Clear filters"
              >
                <XCircle className="h-4 w-4" />
                Clear filters
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showDueTodayToggle && (
                  <DropdownMenuItem onClick={onToggleDueToday}>
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    {isDueTodayActive ? "Show all stories" : "Due today"}
                  </DropdownMenuItem>
                )}
                {showDueWeekToggle && (
                  <DropdownMenuItem onClick={onToggleDueWeek}>
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    {isDueWeekActive ? "Show all stories" : "Due this week"}
                  </DropdownMenuItem>
                )}
                {canRenameEpic && onRenameEpic && (
                  <DropdownMenuItem onClick={onRenameEpic}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Add */}
        <div className="flex items-center gap-2 text-muted-foreground">
          {isSearchView ? (
            <>
              <Search className="w-4 h-4" />
              <Input
                value={searchQuery ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={handleAddStory}
                placeholder="Search stories by title, description, or comments"
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 placeholder:text-muted-foreground/60"
                type="search"
              />
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <Input
                value={newStoryTitle}
                onChange={(e) => setNewStoryTitle(e.target.value)}
                onKeyDown={handleAddStory}
                placeholder="Add story to an epic. Press Enter to save."
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 placeholder:text-muted-foreground/60"
              />
            </>
          )}
        </div>
      </div>

      {/* Story Groups */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {groupedStories.map((group) => (
            <StatusGroup
              key={`${group.status}-${isSearchView ? "search" : "normal"}`}
              title={group.status}
              count={group.stories.length}
              stories={group.stories}
              epics={epics}
              doneStatus={doneStatus}
              defaultStatus={defaultStatus}
              selectedStoryId={selectedStoryId}
              dateMode={dateMode}
              onSelectStory={onSelectStory}
              onUpdateStory={onUpdateStory}
              onDeleteStory={onDeleteStory}
              defaultExpanded={isSearchView || group.status !== "Done"}
            />
          ))}

        {stories.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
          <p className="text-sm">No stories found</p>
          </div>
        )}
      </div>
    </div>
  );
}
