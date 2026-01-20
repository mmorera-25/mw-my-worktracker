import { Story, Epic } from "@/types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw } from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";

interface TaskListItemProps {
  story: Story;
  epic?: Epic;
  isSelected: boolean;
  onClick: () => void;
  onToggleComplete: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  isTrashView?: boolean;
  isCompletedView?: boolean;
}

function getDateLabel(date: Date): { label: string; isOverdue: boolean } {
  if (isToday(date)) {
    return { label: "Today", isOverdue: false };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", isOverdue: false };
  }
  if (isPast(date)) {
    return { label: format(date, "EEE"), isOverdue: true };
  }
  return { label: format(date, "EEE"), isOverdue: false };
}

export function TaskListItem({ 
  story, 
  epic, 
  isSelected, 
  onClick, 
  onToggleComplete,
  onDelete,
  onRestore,
  onPermanentDelete,
  isTrashView,
  isCompletedView
}: TaskListItemProps) {
  const dateInfo = getDateLabel(story.createdAt);
  const isCompleted = story.status === 'done';

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 py-3 transition-all cursor-pointer",
        "hover:bg-hover-overlay",
        isSelected && "bg-selected-bg"
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          "text-sm leading-tight",
          isCompleted ? "text-muted-foreground line-through" : "text-foreground"
        )}>
          {story.title}
        </h3>
        {story.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {story.description}
          </p>
        )}
        {/* Tags */}
        {story.priority === 'high' && !isTrashView && (
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 text-xs rounded bg-destructive/10 text-destructive font-medium">
              urgent
            </span>
          </div>
        )}
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
        ) : (
          <>
            {epic && (
              <span className="text-xs text-muted-foreground">
                {epic.name}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium",
                dateInfo.isOverdue ? "text-destructive" : "text-primary"
              )}>
                {isCompletedView && story.completedAt 
                  ? format(story.completedAt, "MMM d") 
                  : dateInfo.label}
              </span>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
          </>
        )}
      </div>
    </div>
  );
}
