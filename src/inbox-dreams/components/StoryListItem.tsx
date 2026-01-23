import { Story, Epic } from "@inbox/types";
import { cn } from "@inbox/lib/utils";
import { Checkbox } from "@inbox/components/ui/checkbox";
import { Button } from "@inbox/components/ui/button";
import { Trash2, RotateCcw, Flag } from "lucide-react";
import { format, isToday, isPast } from "date-fns";

interface StoryListItemProps {
  story: Story;
  epic?: Epic;
  isSelected: boolean;
  doneStatus: string;
  onClick: () => void;
  onToggleComplete: () => void;
  onPriorityChange?: (priority: Story["priority"]) => void;
  onCompletedDateChange?: (date?: Date) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  isTrashView?: boolean;
  isCompletedView?: boolean;
}

const getEffectiveDueDate = (story: Story) => {
  const dates = story.dueDates && story.dueDates.length > 0 ? story.dueDates : [story.createdAt];
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const upcoming = sorted.find((date) => date >= now);
  return upcoming ?? sorted[sorted.length - 1];
};

export function StoryListItem({
  story,
  epic,
  isSelected,
  doneStatus,
  onClick,
  onToggleComplete,
  onPriorityChange,
  onCompletedDateChange,
  onDelete,
  onRestore,
  onPermanentDelete,
  isTrashView,
  isCompletedView,
}: StoryListItemProps) {
  const effectiveDueDate = getEffectiveDueDate(story);
  const completedDate = story.completedAt;
  const isCompleted = story.status === doneStatus;
  const displayDate = isCompleted && completedDate ? completedDate : effectiveDueDate;
  const isDueToday = isToday(displayDate);
  const isOverdue =
    !isCompleted && isPast(displayDate) && !isDueToday;
  const isDoneDisplay = isCompleted && completedDate;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 py-3 transition-all cursor-pointer",
        "hover:bg-hover-overlay",
        isSelected && "bg-selected-bg"
      )}
      onClick={onClick}
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="pt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
          >
            <Checkbox
              checked={isCompleted}
              className={cn(
                "h-5 w-5 rounded border-2 transition-colors",
                story.priority === 'high' && "border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive",
                story.priority === 'medium' && "border-yellow-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500",
                story.priority === 'low' && "border-border"
              )}
            />
          </div>
          <div className="grid grid-cols-[auto,minmax(0,1fr),auto] items-start gap-3 w-full">
            <div className="flex items-center text-xs text-muted-foreground self-center">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: epic?.color ?? "hsl(215, 16%, 47%)" }}
              >
                {(epic?.key ?? "NE").slice(0, 3).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    "m-0 text-sm leading-tight truncate flex-1",
                    isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {story.title}
                </h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {onPriorityChange && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        const priorities: Story["priority"][] = ["low", "medium", "high"];
                        const currentIndex = priorities.indexOf(story.priority);
                        const nextIndex = (currentIndex + 1) % priorities.length;
                        onPriorityChange(priorities[nextIndex]);
                      }}
                      title="Change priority"
                      aria-label="Change priority"
                    >
                      <Flag
                        className={cn(
                          "w-3.5 h-3.5",
                          story.priority === "high" &&
                            "text-destructive fill-destructive",
                          story.priority === "medium" && "text-yellow-500",
                          story.priority === "low" && "text-muted-foreground"
                        )}
                      />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      title="Move to trash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {story.description
                  ? story.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
                  : "No description"}
              </p>
            </div>
            <div className="-ml-1 flex flex-col items-center justify-center">
              <span
                className={cn(
                  "flex h-12 w-12 flex-col items-center justify-center rounded-md border text-[10px] font-semibold leading-tight",
                  isDoneDisplay
                    ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-700"
                    : isDueToday
                    ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-700"
                    : isOverdue
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-border bg-surface-2 text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "text-lg font-semibold leading-none",
                    isDoneDisplay
                      ? "text-emerald-700"
                      : isDueToday
                      ? "text-yellow-700"
                      : "text-blue-600"
                  )}
                >
                  {format(displayDate, "d")}
                </span>
                <span className="text-[10px] font-semibold">
                  {format(displayDate, "EEE").toUpperCase()}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Epic & Date or Actions */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {isTrashView ? (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRestore?.();
              }}
              title="Restore"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onPermanentDelete?.();
              }}
              title="Delete permanently"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ) : isCompletedView ? (
          <input
            type="date"
            className="h-7 rounded-md border border-panel-border bg-background px-2 text-xs text-muted-foreground"
            value={story.completedAt ? format(story.completedAt, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              const value = e.target.value;
              onCompletedDateChange?.(value ? new Date(`${value}T00:00:00`) : undefined);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
