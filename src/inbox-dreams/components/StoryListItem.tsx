import { useRef } from "react";
import { Story, Epic } from "@inbox/types";
import { cn } from "@inbox/lib/utils";
import { Checkbox } from "@inbox/components/ui/checkbox";
import { Button } from "@inbox/components/ui/button";
import { Trash2, RotateCcw, Flag } from "lucide-react";
import { differenceInCalendarDays, format, isPast, isSameMonth, isToday, startOfMonth } from "date-fns";

interface StoryListItemProps {
  story: Story;
  epic?: Epic;
  isSelected: boolean;
  doneStatus: string;
  dateMode?: "day" | "month";
  onClick: () => void;
  onToggleComplete: () => void;
  onPriorityChange?: (priority: Story["priority"]) => void;
  onCompletedDateChange?: (date?: Date) => void;
  onDueDateChange?: (date: Date) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  isTrashView?: boolean;
  isCompletedView?: boolean;
}

const getEffectiveDueDate = (story: Story) => {
  const dates = story.dueDates && story.dueDates.length > 0 ? story.dueDates : [];
  if (dates.length === 0) return null;
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
  dateMode = "day",
  onClick,
  onToggleComplete,
  onPriorityChange,
  onCompletedDateChange,
  onDueDateChange,
  onDelete,
  onRestore,
  onPermanentDelete,
  isTrashView,
  isCompletedView,
}: StoryListItemProps) {
  const dueInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveDueDate = getEffectiveDueDate(story);
  const completedDate = story.completedAt;
  const isCompleted = story.status === doneStatus;
  const displayDate =
    isCompleted && completedDate
      ? completedDate
      : effectiveDueDate ?? story.startDate ?? story.createdAt;
  const isMonthly = dateMode === "month" || Boolean(story.isYearly);
  const isOnHold = story.status === "On Hold / Waiting";
  const isDueToday = displayDate
    ? isMonthly
      ? isSameMonth(displayDate, new Date())
      : isToday(displayDate)
    : false;
  const isOverdue =
    !isCompleted &&
    Boolean(displayDate) &&
    !isDueToday &&
    (isMonthly
      ? displayDate! < startOfMonth(new Date())
      : isPast(displayDate!));
  const isDoneDisplay = isCompleted && completedDate;
  const now = new Date();
  const dueDays = effectiveDueDate
    ? differenceInCalendarDays(effectiveDueDate, now)
    : null;
  const startDate = story.startDate ? new Date(story.startDate) : null;
  const daysUntilStart = startDate ? differenceInCalendarDays(startDate, now) : null;
  const dueValueClass =
    (dueDays ?? 0) <= 0
      ? "text-destructive"
      : (dueDays ?? 0) <= 3
      ? "text-orange-700"
      : "text-emerald-600";
  const startValueClass =
    (daysUntilStart ?? 0) <= 0
      ? "text-destructive"
      : (daysUntilStart ?? 0) <= 3
      ? "text-orange-700"
      : "text-emerald-600";
  const dueLine = (() => {
    if (startDate && !effectiveDueDate) {
      if (daysUntilStart !== null && daysUntilStart > 0) {
        return (
          <>
            Start in{" "}
            <span className={cn("text-[12px] font-semibold", startValueClass)}>
              {daysUntilStart}
            </span>{" "}
            day{daysUntilStart === 1 ? "" : "s"}
          </>
        );
      }
      if (daysUntilStart === 0) {
        return (
          <>Start today</>
        );
      }
      if (daysUntilStart !== null && daysUntilStart < 0) {
        const daysSinceStart = Math.abs(daysUntilStart);
        return (
          <>
            Started {daysSinceStart} day{daysSinceStart === 1 ? "" : "s"} ago
          </>
        );
      }
    }
    if (startDate && effectiveDueDate && daysUntilStart !== null) {
      if (daysUntilStart > 0) {
        return (
          <>
            Start in{"\u00A0"}
            <span className="font-bold">{daysUntilStart}</span>
            {"\u00A0"}day{daysUntilStart === 1 ? "" : "s"}
          </>
        );
      }
      if (daysUntilStart === 0) {
        return <>Start today</>;
      }
    }
    if (dueDays === null) {
      return <>No due date</>;
    }
    if (dueDays > 0) {
      return (
        <>
          Due in{"\u00A0"}
          <span className="font-bold">{dueDays}</span>
          {"\u00A0"}
          day{dueDays === 1 ? "" : "s"}
        </>
      );
    }
    if (dueDays === 0) {
      return <>Due today</>;
    }
    const overdueDays = Math.abs(dueDays);
    return (
      <>
        Due {overdueDays} day{overdueDays === 1 ? "" : "s"} ago
      </>
    );
  })();
  const duePillTextClass =
    dueDays === null
      ? "text-muted-foreground"
      : dueDays === 0
      ? "text-yellow-700 font-semibold"
      : dueDays < 0
      ? "text-destructive"
      : "text-muted-foreground";
  const pillBaseClass =
    "inline-flex items-center rounded-full border border-panel-border bg-muted px-2 py-0.5 text-[10px] leading-none font-medium";
  const duePillBackgroundClass =
    dueDays === 0 ? "border-yellow-500/60 bg-yellow-500/15" : "";
  const quarterLabel = `Q${Math.floor(displayDate.getMonth() / 3) + 1}`;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 pl-4 pr-0 py-3 transition-all cursor-pointer",
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
          <div className="grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-start gap-3 w-full">
            <div className="flex items-center text-xs text-muted-foreground self-center">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: epic?.color ?? "hsl(215, 16%, 47%)" }}
              >
                {(epic?.key ?? "NE").slice(0, 3).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex flex-col">
              <p className="text-[11px] text-muted-foreground">
                {epic?.name ?? "No epic"}
              </p>
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    "m-0 text-sm leading-tight line-clamp-2 flex-1",
                    isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {story.title}
                </h3>
              </div>
              <div className="mt-1 flex flex-nowrap items-center gap-1.5">
                <span
                  className={cn(
                    pillBaseClass,
                    duePillTextClass,
                    duePillBackgroundClass
                  )}
                >
                  {dueLine}
                </span>
                {story.typeOfWork ? (
                  <span
                    className={cn(
                      pillBaseClass,
                      "text-muted-foreground"
                    )}
                  >
                    {story.typeOfWork}
                  </span>
                ) : null}
              </div>
            </div>
            {effectiveDueDate ? (
              <div className="-ml-1 flex flex-col items-center justify-center">
                <button
                  type="button"
                  className={cn(
                    "relative flex h-14 w-12 flex-col items-center justify-center gap-0.5 rounded-md border text-[10px] font-semibold leading-tight transition-colors",
                    isOnHold
                      ? "border-border bg-transparent text-muted-foreground"
                      : isDoneDisplay
                      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-700"
                      : isDueToday
                      ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-700 due-today-pulse"
                      : isOverdue
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-surface-2 text-muted-foreground",
                    onDueDateChange ? "hover:bg-hover-overlay cursor-pointer" : "cursor-default"
                  )}
                  aria-label="Change due date"
                  title="Change due date"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!onDueDateChange) return;
                    const input = dueInputRef.current;
                    if (!input) return;
                    input.focus();
                    if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
                      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                    }
                  }}
                >
                  <input
                    ref={dueInputRef}
                    type={isMonthly ? "month" : "date"}
                    value={
                      effectiveDueDate
                        ? format(effectiveDueDate, isMonthly ? "yyyy-MM" : "yyyy-MM-dd")
                        : ""
                    }
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) return;
                      const nextDate = isMonthly
                        ? new Date(`${value}-01T00:00:00`)
                        : new Date(`${value}T00:00:00`);
                      onDueDateChange?.(nextDate);
                    }}
                    className="due-date-input absolute inset-0 z-10 h-full w-full cursor-pointer"
                    aria-hidden="true"
                    disabled={!onDueDateChange}
                  />
                  {isMonthly ? (
                    <>
                      <span
                        className={cn(
                          "text-lg font-semibold leading-none pointer-events-none",
                          isDoneDisplay
                            ? "text-emerald-700"
                            : "text-blue-600"
                        )}
                      >
                        {quarterLabel}
                      </span>
                      <span className="text-[10px] font-semibold pointer-events-none">
                        {format(displayDate, "MMM")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "text-[10px] font-semibold pointer-events-none",
                          isOnHold ? "text-muted-foreground" : ""
                        )}
                      >
                        {format(displayDate, "EEE").toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "text-lg font-semibold leading-none pointer-events-none",
                          isDoneDisplay
                            ? "text-emerald-700"
                            : isOnHold
                            ? "text-foreground"
                            : "text-blue-600"
                        )}
                      >
                        {format(displayDate, "d")}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold pointer-events-none",
                          isOnHold ? "text-muted-foreground" : ""
                        )}
                      >
                        {format(displayDate, "MMM").toUpperCase()}
                      </span>
                    </>
                  )}
                </button>
              </div>
            ) : null}
            {(onPriorityChange || onDelete) && (
              <div className="flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
            )}
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
