import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";
import { cn } from "@inbox/lib/utils";
import { Button } from "@inbox/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@inbox/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inbox/components/ui/select";
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
  bucketMap: Record<string, KanbanBucket>;
  selectedStoryId?: string | null;
  onSelectStory?: (storyId: string) => void;
  statusFilters: string[];
  typeOfWorkFilters: string[];
  statusFilterOptions: string[];
  typeFilterOptions: string[];
  dueFilter: "all" | "today" | "next-week";
  statusOrder: string[];
  onStatusFiltersChange: (value: string[]) => void;
  onTypeOfWorkFiltersChange: (value: string[]) => void;
  onDueFilterChange: (value: "all" | "today" | "next-week") => void;
  onSetStoryStatus?: (storyId: string, status: string) => void;
};

const getEffectiveDueDate = (story: Story) => {
  const dates = story.dueDates && story.dueDates.length > 0 ? story.dueDates : [];
  if (dates.length === 0) return null;
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const upcoming = sorted.find((date) => date >= now);
  return upcoming ?? sorted[sorted.length - 1];
};

const getCompletedMonthKey = (story: Story) =>
  story.completedAt ? format(story.completedAt, "yyyy-MM") : "no-date";

const getCompletedMonthLabel = (key: string) => {
  if (key === "no-date") return "No date";
  const [year, month] = key.split("-").map((value) => Number(value));
  if (!year || !month) return "No date";
  return format(new Date(year, month - 1, 1), "MMM yyyy");
};

const groupCompletedStories = (stories: Story[]) => {
  const groups = new Map<string, { key: string; label: string; stories: Story[] }>();
  stories.forEach((story) => {
    const key = getCompletedMonthKey(story);
    const label = getCompletedMonthLabel(key);
    if (!groups.has(key)) {
      groups.set(key, { key, label, stories: [] });
    }
    groups.get(key)!.stories.push(story);
  });
  return Array.from(groups.values());
};

const StoryCard = ({
  story,
  epic,
  bucket,
  isSelected,
  isDragging,
  isDropped,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  story: Story;
  epic?: Epic;
  bucket: KanbanBucket;
  isSelected?: boolean;
  isDragging?: boolean;
  isDropped?: boolean;
  onSelect?: () => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}) => {
  const dueDate = getEffectiveDueDate(story);
  const completedDate = story.completedAt ?? null;
  const daysToDue = dueDate ? differenceInCalendarDays(dueDate, new Date()) : null;
  const dueBadgeClass = (() => {
    if (bucket === "completed") return "bg-emerald-100 text-emerald-700";
    if (!dueDate) return "bg-slate-100 text-slate-700";
    if (isPast(dueDate) && !isToday(dueDate)) return "bg-rose-100 text-rose-700";
    if (daysToDue !== null && daysToDue <= 3) return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  })();
  const startDate = story.startDate ?? null;
  const badgeLabel =
    bucket === "completed"
      ? completedDate
        ? format(completedDate, "MMM d")
        : "No date"
      : startDate && dueDate
      ? `${format(startDate, "MMM d")} - ${format(dueDate, "MMM d")}`
      : dueDate
      ? format(dueDate, "MMM d")
      : "No date";
  const bucketTint =
    bucket === "working"
      ? "border-amber-300/70 bg-amber-50/80"
      : bucket === "on-hold"
      ? "border-slate-300/70 bg-slate-50/80"
      : bucket === "completed"
      ? "border-emerald-300/70 bg-emerald-50/80"
      : "border-slate-300/70 bg-card";

  return (
    <div
      draggable
      data-dragging={isDragging ? "true" : "false"}
      data-dropped={isDropped ? "true" : "false"}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", story.id);
        onDragStart?.(story.id);
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "cursor-grab rounded-xl border px-3 py-3 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md data-[dragging=true]:scale-[0.98] data-[dragging=true]:opacity-70 data-[dragging=true]:shadow-none data-[dropped=true]:scale-[1.02] data-[dropped=true]:shadow-md",
        bucketTint,
        isSelected ? "ring-2 ring-accent/70" : "ring-0",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{story.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 font-semibold",
              dueBadgeClass,
            )}
          >
            {badgeLabel}
          </span>
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
    </div>
  );
};

export const StoryKanban = ({
  stories,
  epics,
  bucketMap,
  selectedStoryId,
  onSelectStory,
  statusFilters,
  typeOfWorkFilters,
  statusFilterOptions,
  typeFilterOptions,
  dueFilter,
  statusOrder,
  onStatusFiltersChange,
  onTypeOfWorkFiltersChange,
  onDueFilterChange,
  onSetStoryStatus,
}: StoryKanbanProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [droppedId, setDroppedId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    storyId: string;
    bucket: KanbanBucket;
  } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [completedMonthsFilter, setCompletedMonthsFilter] = useState<string[]>([]);
  const currentMonthKey = useMemo(() => format(new Date(), "yyyy-MM"), []);

  const bucketForStatus = (status: string): KanbanBucket => bucketMap[status] ?? "not-started";

  const completedMonthOptions = useMemo(() => {
    const monthKeys = new Set<string>();
    stories.forEach((story) => {
      if (bucketForStatus(story.status) !== "completed") return;
      monthKeys.add(getCompletedMonthKey(story));
    });
    const entries = Array.from(monthKeys).map((key) => {
      const sortValue =
        key === "no-date"
          ? Number.NEGATIVE_INFINITY
          : Number(key.replace("-", ""));
      return { key, label: getCompletedMonthLabel(key), sortValue };
    });
    entries.sort((a, b) => b.sortValue - a.sortValue);
    return entries;
  }, [stories, bucketMap]);

  useEffect(() => {
    const optionKeys = completedMonthOptions.map((option) => option.key);
    if (optionKeys.length === 0) {
      setCompletedMonthsFilter([]);
      return;
    }
    const hasInvalid = completedMonthsFilter.some((key) => !optionKeys.includes(key));
    if (completedMonthsFilter.length === 0) {
      if (optionKeys.includes(currentMonthKey)) {
        setCompletedMonthsFilter([currentMonthKey]);
      } else {
        setCompletedMonthsFilter(optionKeys);
      }
      return;
    }
    if (hasInvalid) {
      setCompletedMonthsFilter(
        completedMonthsFilter.filter((key) => optionKeys.includes(key)),
      );
    }
  }, [completedMonthOptions, completedMonthsFilter, currentMonthKey]);

  const lanes = useMemo(() => {
    const monthFilterSet = new Set(completedMonthsFilter);
    const useAllMonths = completedMonthsFilter.length === 0;
    return KANBAN_BUCKETS.map((lane) => {
      const laneStories = stories
        .filter((story) => bucketForStatus(story.status) === lane.id)
        .filter((story) => {
          if (lane.id !== "completed") return true;
          if (useAllMonths) return true;
          const key = getCompletedMonthKey(story);
          return monthFilterSet.has(key);
        })
        .sort((a, b) => {
          if (lane.id === "completed") {
            const aCompleted = a.completedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
            const bCompleted = b.completedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
            if (aCompleted !== bCompleted) return bCompleted - aCompleted;
            return b.createdAt.getTime() - a.createdAt.getTime();
          }
          const aDue = getEffectiveDueDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
          const bDue = getEffectiveDueDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aDue !== bDue) return aDue - bDue;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });
      return { ...lane, stories: laneStories };
    });
  }, [stories, bucketMap, completedMonthsFilter]);

  const epicMap = useMemo(() => {
    return epics.reduce<Record<string, Epic>>((acc, epic) => {
      acc[epic.id] = epic;
      return acc;
    }, {});
  }, [epics]);

  const pendingStatusOptions = useMemo(() => {
    if (!pendingDrop) return [];
    return statusOrder.filter((status) => bucketForStatus(status) === pendingDrop.bucket);
  }, [pendingDrop, statusOrder, bucketMap]);

  const pendingStory = useMemo(() => {
    if (!pendingDrop) return null;
    return stories.find((story) => story.id === pendingDrop.storyId) ?? null;
  }, [pendingDrop, stories]);

  useEffect(() => {
    if (!pendingDrop) {
      setPendingStatus("");
      return;
    }
    if (pendingStatusOptions.length === 0) {
      setPendingStatus("");
      return;
    }
    const currentStatus = pendingStory?.status ?? "";
    if (currentStatus && pendingStatusOptions.includes(currentStatus)) {
      setPendingStatus(currentStatus);
    } else {
      setPendingStatus(pendingStatusOptions[0]);
    }
  }, [pendingDrop, pendingStatusOptions, pendingStory]);

  const selectedStatusCount = statusFilters.length;
  const selectedTypeCount = typeOfWorkFilters.length;
  const selectedCompletedCount = completedMonthsFilter.length;
  const completedFilterActive =
    completedMonthOptions.length > 0 &&
    selectedCompletedCount !== completedMonthOptions.length;
  const showFiltersApplied =
    dueFilter !== "all" ||
    selectedStatusCount !== statusFilterOptions.length ||
    selectedTypeCount !== typeFilterOptions.length ||
    completedFilterActive;

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
                setCompletedMonthsFilter(completedMonthOptions.map((option) => option.key));
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                Completed months
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {completedMonthOptions.length === 0
                    ? "None"
                    : selectedCompletedCount}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="px-0 py-0">Completed months</DropdownMenuLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() =>
                    setCompletedMonthsFilter(completedMonthOptions.map((option) => option.key))
                  }
                  disabled={completedMonthOptions.length === 0}
                >
                  All
                </Button>
              </div>
              <DropdownMenuSeparator />
              {completedMonthOptions.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No completed stories yet.</div>
              ) : (
                completedMonthOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.key}
                    checked={completedMonthsFilter.includes(option.key)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setCompletedMonthsFilter([...completedMonthsFilter, option.key]);
                      } else {
                        setCompletedMonthsFilter(
                          completedMonthsFilter.filter((key) => key !== option.key),
                        );
                      }
                    }}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto pb-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
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
                setPendingDrop({ storyId: incomingId, bucket: lane.id });
                setDraggedId(null);
              }}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-panel-border bg-surface-2/80 p-3 shadow-sm self-start",
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
                  (lane.id === "completed"
                    ? groupCompletedStories(lane.stories)
                    : [{ key: "all", label: "", stories: lane.stories }]
                  ).map((group) => (
                    <div key={group.key} className="space-y-2">
                      {lane.id === "completed" ? (
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {group.label}
                        </div>
                      ) : null}
                      {group.stories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          epic={epicMap[story.epicId]}
                          bucket={lane.id}
                          isSelected={selectedStoryId === story.id}
                          isDragging={draggedId === story.id}
                          isDropped={droppedId === story.id}
                          onSelect={() => onSelectStory?.(story.id)}
                          onDragStart={(id) => {
                            setDraggedId(id);
                          }}
                          onDragEnd={() => {
                            if (draggedId === story.id) {
                              setDroppedId(story.id);
                              window.setTimeout(() => {
                                setDroppedId((prev) => (prev === story.id ? null : prev));
                              }, 180);
                            }
                            setDraggedId(null);
                          }}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={Boolean(pendingDrop)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDrop(null);
            setPendingStatus("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select status</DialogTitle>
            <DialogDescription>
              Choose the status for this card in the new column.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {pendingStatusOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No statuses mapped to this column yet. Update your settings to add one.
              </p>
            ) : (
              <Select value={pendingStatus} onValueChange={setPendingStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {pendingStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPendingDrop(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pendingDrop || !pendingStatus) return;
                onSetStoryStatus?.(pendingDrop.storyId, pendingStatus);
                setPendingDrop(null);
              }}
              disabled={!pendingStatusOptions.length || !pendingStatus}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoryKanban;
