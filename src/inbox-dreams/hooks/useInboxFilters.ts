import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { addWeeks, endOfWeek, isSameDay, startOfWeek } from "date-fns";
import type { Story } from "@inbox/types";

type UseInboxFiltersInput = {
  stories: Story[];
  statusOptions: string[];
  doneStatus: string;
  typeOfWorkOptions: string[];
};

export function useInboxFilters({
  stories,
  statusOptions,
  doneStatus,
  typeOfWorkOptions,
}: UseInboxFiltersInput) {
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeOfWorkFilters, setTypeOfWorkFilters] = useState<string[]>([]);
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "next-week">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const statusFiltersInitialized = useRef(false);
  const typeFiltersInitialized = useRef(false);

  const allStatusOptions = useMemo(() => {
    const options = statusOptions.filter((status) => status !== "Saved");
    const hasSaved = stories.some((story) => story.status === "Saved");
    const merged = hasSaved ? [...options, "Saved"] : options;
    return Array.from(new Set(merged));
  }, [stories, statusOptions]);

  const allStatusFilterOptions = useMemo(() => {
    const storyStatuses = stories.map((story) => story.status).filter(Boolean);
    return Array.from(new Set([...allStatusOptions, ...storyStatuses]));
  }, [allStatusOptions, stories]);

  const allTypeFilterOptions = useMemo(() => {
    const storyTypes = stories
      .map((story) => story.typeOfWork?.trim())
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...typeOfWorkOptions, ...storyTypes, "__unassigned__"]));
  }, [typeOfWorkOptions, stories]);

  useEffect(() => {
    if (statusFiltersInitialized.current) return;
    const defaultFilters = allStatusOptions.filter(
      (status) => status !== doneStatus && status !== "Saved" && status !== "Backlog"
    );
    setStatusFilters(defaultFilters);
    statusFiltersInitialized.current = true;
  }, [allStatusOptions, doneStatus]);

  useEffect(() => {
    if (typeFiltersInitialized.current) return;
    setTypeOfWorkFilters([...typeOfWorkOptions, "__unassigned__"]);
    typeFiltersInitialized.current = true;
  }, [typeOfWorkOptions]);

  const typeUsageCounts = useMemo(() => {
    return stories
      .filter((story) => !story.isDeleted)
      .reduce<Record<string, number>>((acc, story) => {
        const key = story.typeOfWork?.trim();
        if (!key) return acc;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
  }, [stories]);

  const statusUsageCounts = useMemo(() => {
    return stories
      .filter((story) => !story.isDeleted)
      .reduce<Record<string, number>>((acc, story) => {
        acc[story.status] = (acc[story.status] ?? 0) + 1;
        return acc;
      }, {});
  }, [stories]);

  const getFilteredStories = useCallback(
    (view: string, selectedEpicId?: string) => {
      const yearlyStories = stories.filter((s) => s.isYearly);
      const regularStories = stories.filter((s) => !s.isYearly);

      let result =
        view === "yearly"
          ? yearlyStories
          : view === "trash"
          ? stories
          : regularStories;

      if (view === "trash") {
        result = result.filter((s) => s.isDeleted);
      } else {
        result = result.filter((s) => !s.isDeleted);
      }

      if (selectedEpicId && !["completed", "trash"].includes(view)) {
        result = result.filter((s) => s.epicId === selectedEpicId);
      }

      if (view === "search" && searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        result = result.filter((story) => {
          const content = [
            story.title,
            story.description,
            ...(story.comments?.map((comment) => comment.text) ?? []),
          ]
            .filter(Boolean)
            .map((entry) =>
              String(entry)
                .replace(/<[^>]+>/g, " ")
                .toLowerCase()
            );
          return content.some((entry) => entry.includes(term));
        });
      }

      if (view === "week" || view === "yearly" || view === "kanban") {
        if (statusFilters.length === 0) {
          result = [];
        } else {
          result = result.filter((story) => statusFilters.includes(story.status));
        }
        if (typeOfWorkFilters.length === 0) {
          result = [];
        } else {
          result = result.filter((story) => {
            const value = story.typeOfWork?.trim();
            if (!value) return typeOfWorkFilters.includes("__unassigned__");
            return typeOfWorkFilters.includes(value);
          });
        }
      }

      if (view === "week" || view === "kanban") {
        if (dueFilter === "today") {
          const today = new Date();
          result = result.filter(
            (story) => story.dueDates?.some((date) => isSameDay(date, today)) ?? false
          );
        } else if (dueFilter === "next-week") {
          const today = new Date();
          const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
          const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
          result = result.filter(
            (story) =>
              story.dueDates?.some(
                (date) => date >= nextWeekStart && date <= nextWeekEnd
              ) ?? false
          );
        }
      }

      return result;
    },
    [stories, statusFilters, typeOfWorkFilters, dueFilter, searchQuery]
  );

  const getStoryCounts = useCallback(
    (view: string) => {
      const source =
        view === "yearly"
          ? stories.filter((s) => s.isYearly)
          : stories.filter((s) => !s.isYearly);
      const counts: Record<string, number> = {};
      source
        .filter((s) => !s.isDeleted)
        .forEach((story) => {
          counts[story.epicId] = (counts[story.epicId] || 0) + 1;
        });
      return counts;
    },
    [stories]
  );

  return {
    statusFilters,
    setStatusFilters,
    typeOfWorkFilters,
    setTypeOfWorkFilters,
    dueFilter,
    setDueFilter,
    searchQuery,
    setSearchQuery,
    allStatusFilterOptions,
    allTypeFilterOptions,
    statusUsageCounts,
    typeUsageCounts,
    getFilteredStories,
    getStoryCounts,
  };
}

export default useInboxFilters;
