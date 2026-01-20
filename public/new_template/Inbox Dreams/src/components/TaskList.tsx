import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, ArrowUpDown, Trash2, RotateCcw } from "lucide-react";
import { Story, Epic } from "@/types";
import { TaskListItem } from "./TaskListItem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, isThisWeek, addDays } from "date-fns";

interface TaskListProps {
  stories: Story[];
  epics: Epic[];
  selectedStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  onCreateStory: () => void;
  onUpdateStory: (story: Story) => void;
  onDeleteStory: (storyId: string) => void;
  onRestoreStory: (storyId: string) => void;
  onPermanentDelete: (storyId: string) => void;
  viewTitle: string;
  activeView: string;
}

interface GroupedStories {
  overdue: Story[];
  today: Story[];
  tomorrow: Story[];
  thisWeek: Story[];
  later: Story[];
}

function groupStoriesByDate(stories: Story[]): GroupedStories {
  const now = new Date();
  const groups: GroupedStories = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
  };

  stories.forEach((story) => {
    const date = story.createdAt;
    if (isPast(date) && !isToday(date)) {
      groups.overdue.push(story);
    } else if (isToday(date)) {
      groups.today.push(story);
    } else if (isTomorrow(date)) {
      groups.tomorrow.push(story);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(story);
    } else {
      groups.later.push(story);
    }
  });

  return groups;
}

interface DateGroupProps {
  title: string;
  count: number;
  stories: Story[];
  epics: Epic[];
  selectedStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  onUpdateStory: (story: Story) => void;
  onDeleteStory: (storyId: string) => void;
  isOverdue?: boolean;
  defaultExpanded?: boolean;
}

function DateGroup({ 
  title, 
  count, 
  stories, 
  epics, 
  selectedStoryId, 
  onSelectStory, 
  onUpdateStory,
  onDeleteStory,
  isOverdue,
  defaultExpanded = true
}: DateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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
        <span className={cn(
          "font-medium",
          isOverdue ? "text-destructive" : "text-foreground"
        )}>
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{count}</span>
        {isOverdue && (
          <button className="ml-auto text-xs text-primary hover:underline">
            Postpone
          </button>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-0.5">
          {stories.map((story) => (
            <TaskListItem
              key={story.id}
              story={story}
              epic={epics.find((e) => e.id === story.epicId)}
              isSelected={selectedStoryId === story.id}
              onClick={() => onSelectStory(story.id)}
              onToggleComplete={() => {
                onUpdateStory({
                  ...story,
                  status: story.status === 'done' ? 'todo' : 'done'
                });
              }}
              onDelete={() => onDeleteStory(story.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskList({
  stories,
  epics,
  selectedStoryId,
  onSelectStory,
  onCreateStory,
  onUpdateStory,
  onDeleteStory,
  onRestoreStory,
  onPermanentDelete,
  viewTitle,
  activeView,
}: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const isCompletedView = activeView === 'completed';
  const isTrashView = activeView === 'trash';

  const groupedStories = useMemo(() => groupStoriesByDate(stories), [stories]);

  const handleAddTask = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTaskTitle.trim()) {
      onCreateStory();
      setNewTaskTitle("");
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
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowUpDown className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Task List */}
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
                    <p className="text-sm">No completed tasks</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {stories.map((story) => (
                <TaskListItem
                  key={story.id}
                  story={story}
                  epic={epics.find((e) => e.id === story.epicId)}
                  isSelected={selectedStoryId === story.id}
                  onClick={() => onSelectStory(story.id)}
                  onToggleComplete={() => {
                    onUpdateStory({
                      ...story,
                      status: story.status === 'done' ? 'todo' : 'done'
                    });
                  }}
                  onDelete={() => onDeleteStory(story.id)}
                  onRestore={() => onRestoreStory(story.id)}
                  onPermanentDelete={() => onPermanentDelete(story.id)}
                  isTrashView={isTrashView}
                  isCompletedView={isCompletedView}
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowUpDown className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Add */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Plus className="w-4 h-4" />
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleAddTask}
            placeholder='Add task to "Inbox". Press Enter to save.'
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Task Groups */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <DateGroup
          title="Overdue"
          count={groupedStories.overdue.length}
          stories={groupedStories.overdue}
          epics={epics}
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          onUpdateStory={onUpdateStory}
          onDeleteStory={onDeleteStory}
          isOverdue
        />

        <DateGroup
          title={`Tomorrow, ${format(addDays(new Date(), 1), 'EEE')}`}
          count={groupedStories.tomorrow.length}
          stories={groupedStories.tomorrow}
          epics={epics}
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          onUpdateStory={onUpdateStory}
          onDeleteStory={onDeleteStory}
        />

        <DateGroup
          title="This Week"
          count={groupedStories.thisWeek.length}
          stories={groupedStories.thisWeek}
          epics={epics}
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          onUpdateStory={onUpdateStory}
          onDeleteStory={onDeleteStory}
        />

        <DateGroup
          title="Later"
          count={groupedStories.later.length}
          stories={groupedStories.later}
          epics={epics}
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          onUpdateStory={onUpdateStory}
          onDeleteStory={onDeleteStory}
        />

        {stories.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No tasks found</p>
          </div>
        )}
      </div>
    </div>
  );
}
