import { useMemo, useState } from "react";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";
import { cn } from "@inbox/lib/utils";
import { Button } from "@inbox/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@inbox/components/ui/dropdown-menu";
import { XCircle } from "lucide-react";
import type { Epic, Story } from "@inbox/types";
import type { KanbanBucket } from "../../lib/settings/configRepository";
import { KANBAN_BUCKETS } from "../../lib/settings/configRepository";

type StoryKanbanProps = {
  stories: Story[];
  epics: Epic[];
  statusOrder: string[];
  bucketMap: Record<string, KanbanBucket>;
  selectedStoryId?: string | null;
  onSelectStory?: (storyId: string) => void;
  onMoveStory?: (storyId: string, bucket: KanbanBucket) => void;
  statusFilters: string[];
  typeOfWorkFilters: string[];
  statusFilterOptions: string[];
  typeFilterOptions: string[];
  dueFilter: "all" | "today" | "next-week";
  onStatusFiltersChange: (value: string[]) => void;
  onTypeOfWorkFiltersChange: (value: string[]) => void;
  onDueFilterChange: (value: "all" | "today" | "next-week") => void;
};

const getEffectiveDueDate = (story: Story) => {
  const dates = story.dueDates && story.dueDates.length > 0 ? story.dueDates : [];
  if (dates.length === 0) return null;
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const upcoming = sorted.find((date) => date >= now);
  return upcoming ?? sorted[sorted.length - 1];
};

const statusRank = (order: string[], status: string) => {
  const idx = order.findIndex((item) => item === status);
  return idx === -1 ? order.length + 1 : idx;
};

const StoryCard = ({
  story,
  epic,
  bucket,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  story: Story;
  epic?: Epic;
  bucket: KanbanBucket;
  isSelected?: boolean;
  onSelect?: () => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}) => {
  const dueDate = getEffectiveDueDate(story);
  const daysToDue = dueDate ? differenceInCalendarDays(dueDate, new Date()) : null;
  const dueBadgeClass = (() => {
    if (!dueDate) return "bg-slate-100 text-slate-700";
    if (isPast(dueDate) && !isToday(dueDate)) return "bg-rose-100 text-rose-700";
    if (daysToDue !== null && daysToDue <= 3) return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  })();
  const bucketTint =
    bucket === "working"
      ? "border-amber-300/70 bg-amber-50/80"
      : bucket === "completed"
      ? "border-emerald-300/70 bg-emerald-50/80"
      : "border-slate-300/70 bg-card";

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", story.id);
        onDragStart?.(story.id);
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "cursor-grab rounded-xl border px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        bucketTint,
        isSelected ? "ring-2 ring-accent/70" : "ring-0",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground line-clamp-2">{story.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
              title="Epic"
            >
              <span
                className="h-2 w-2 rounded-full border border-black/5"
                style={{ backgroundColor: epic?.color ?? "hsl(215, 16%, 47%)" }}
              />
              {epic?.name ?? "No epic"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
              {story.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-800">
              {story.typeOfWork?.trim() || "Unassigned"}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", dueBadgeClass)}>
            {dueDate ? format(dueDate, "MMM d") : "No date"}
          </span>
        </div>
      </div>
    </div>
  );
};

export const StoryKanban = ({
  stories,
  epics,
  statusOrder,
  bucketMap,
  selectedStoryId,
  onSelectStory,
  onMoveStory,
  statusFilters,
  typeOfWorkFilters,
  statusFilterOptions,
  typeFilterOptions,
  dueFilter,
  onStatusFiltersChange,
  onTypeOfWorkFiltersChange,
  onDueFilterChange,
}: StoryKanbanProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const bucketForStatus = (status: string): KanbanBucket => bucketMap[status] ?? "not-started";

  const lanes = useMemo(() => {
    return KANBAN_BUCKETS.map((lane) => {
      const laneStories = stories
        .filter((story) => bucketForStatus(story.status) === lane.id)
        .sort((a, b) => {
          const rankDiff = statusRank(statusOrder, a.status) - statusRank(statusOrder, b.status);
          if (rankDiff !== 0) return rankDiff;
          const aDue = getEffectiveDueDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
          const bDue = getEffectiveDueDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aDue !== bDue) return aDue - bDue;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      return { ...lane, stories: laneStories };
    });
  }, [stories, statusOrder, bucketMap]);

  const epicMap = useMemo(() => {
    return epics.reduce<Record<string, Epic>>((acc, epic) => {
      acc[epic.id] = epic;
      return acc;
    }, {});
  }, [epics]);

  const selectedStatusCount = statusFilters.length;
  const selectedTypeCount = typeOfWorkFilters.length;
  const showFiltersApplied =
    dueFilter !== "all" ||
    selectedStatusCount !== statusFilterOptions.length ||
    selectedTypeCount !== typeFilterOptions.length;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Kanban board</p>
          <p className="text-xs text-muted-foreground">
            Drag stories between buckets to update their status mapping.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showFiltersApplied ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                onStatusFiltersChange(statusFilterOptions);
                onTypeOfWorkFiltersChange(typeFilterOptions);
                onDueFilterChange("all");
              }}
              title="Clear filters"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                Due
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {dueFilter === "all" ? "All" : dueFilter === "today" ? "Today" : "Next week"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="px-0 py-0">Due</DropdownMenuLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onDueFilterChange("all")}
                >
                  All
                </Button>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={dueFilter === "today"} onCheckedChange={() => onDueFilterChange("today")}>
                Today
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={dueFilter === "next-week"}
                onCheckedChange={() => onDueFilterChange("next-week")}
              >
                Next week
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                Status
                <span className="ml-1 text-[10px] text-muted-foreground">{selectedStatusCount}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="px-0 py-0">Status</DropdownMenuLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() =>
                    onStatusFiltersChange(
                      statusFilters.length === statusFilterOptions.length ? [] : statusFilterOptions,
                    )
                  }
                >
                  {statusFilters.length === statusFilterOptions.length ? "None" : "All"}
                </Button>
              </div>
              <DropdownMenuSeparator />
              {statusFilterOptions.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilters.includes(status)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onStatusFiltersChange([...statusFilters, status]);
                    } else {
                      onStatusFiltersChange(statusFilters.filter((item) => item !== status));
                    }
                  }}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                Type
                <span className="ml-1 text-[10px] text-muted-foreground">{selectedTypeCount}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="px-0 py-0">Type of work</DropdownMenuLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() =>
                    onTypeOfWorkFiltersChange(
                      typeOfWorkFilters.length === typeFilterOptions.length ? [] : typeFilterOptions,
                    )
                  }
                >
                  {typeOfWorkFilters.length === typeFilterOptions.length ? "None" : "All"}
                </Button>
              </div>
              <DropdownMenuSeparator />
              {typeFilterOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={typeOfWorkFilters.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onTypeOfWorkFiltersChange([...typeOfWorkFilters, option]);
                    } else {
                      onTypeOfWorkFiltersChange(typeOfWorkFilters.filter((item) => item !== option));
                    }
                  }}
                >
                  {option === "__unassigned__" ? "Unassigned" : option}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto pb-4 md:grid-cols-3">
        {lanes.map((lane) => {
          const isActiveDrop = draggedId !== null;
          return (
            <div
              key={lane.id}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const incomingId = draggedId ?? e.dataTransfer.getData("text/plain");
                if (!incomingId) return;
                onMoveStory?.(incomingId, lane.id);
                setDraggedId(null);
              }}
              className={cn(
                "flex min-h-[280px] flex-col gap-3 rounded-2xl border border-panel-border bg-surface-2/80 p-3 shadow-sm",
                isActiveDrop ? "transition-shadow hover:shadow-md" : "",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  {lane.label}
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">{lane.stories.length}</span>
              </div>

              <div className="space-y-2">
                {lane.stories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-panel-border bg-transparent px-3 py-8 text-center text-xs text-muted-foreground">
                    Drop stories here
                  </div>
                ) : (
                  lane.stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      epic={epicMap[story.epicId]}
                      bucket={lane.id}
                      isSelected={selectedStoryId === story.id}
                      onSelect={() => onSelectStory?.(story.id)}
                      onDragStart={(id) => {
                        setDraggedId(id);
                      }}
                      onDragEnd={() => setDraggedId(null)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StoryKanban;
