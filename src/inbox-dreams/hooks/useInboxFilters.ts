import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { addWeeks, endOfWeek, isSameDay, startOfWeek } from "date-fns";
import type { Story } from "@inbox/types";

type UseInboxFiltersInput = {
  stories: Story[];
  statusOptions: string[];
  typeOfWorkOptions: string[];
  activeView: string;
};

const STORAGE_KEY = (view: string) => `inbox-filters-${view}`;

type StoredFilters = {
  statusFilters: string[];
  typeOfWorkFilters: string[];
  dueFilter: "all" | "today" | "next-week";
  searchQuery: string;
};

const defaultStored: StoredFilters = {
  statusFilters: [],
  typeOfWorkFilters: [],
  dueFilter: "all",
  searchQuery: "",
};

export function useInboxFilters({
  stories,
  statusOptions,
  typeOfWorkOptions,
  activeView,
}: UseInboxFiltersInput) {
  const hasLoadedRef = useRef(false);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeOfWorkFilters, setTypeOfWorkFilters] = useState<string[]>([]);
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "next-week">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const persistFilters = useCallback(
    (view: string, next: Partial<StoredFilters>) => {
      if (!["week", "yearly"].includes(view)) return;
      try {
        const current: StoredFilters = {
          statusFilters,
          typeOfWorkFilters,
          dueFilter,
          searchQuery,
        };
        const merged = { ...current, ...next };
        window.localStorage.setItem(STORAGE_KEY(view), JSON.stringify(merged));
      } catch (err) {
        console.warn("Failed to persist inbox filters", err);
      }
    },
    [statusFilters, typeOfWorkFilters, dueFilter, searchQuery]
  );

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

  // Load filters for the active view; when no stored filters exist, default to "all options selected"
  useEffect(() => {
    if (!["week", "yearly"].includes(activeView)) return;
    // Wait until options are available so we can select all of them
    if (allStatusFilterOptions.length === 0 && allTypeFilterOptions.length === 0) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY(activeView));
      if (!raw) {
        setStatusFilters(allStatusFilterOptions);
        setTypeOfWorkFilters(allTypeFilterOptions);
        setDueFilter("all");
        setSearchQuery("");
        hasLoadedRef.current = true;
        persistFilters(activeView, {
          statusFilters: allStatusFilterOptions,
          typeOfWorkFilters: allTypeFilterOptions,
          dueFilter: "all",
          searchQuery: "",
        });
        return;
      }
      const parsed: StoredFilters = JSON.parse(raw);
      setStatusFilters(parsed.statusFilters ?? []);
      setTypeOfWorkFilters(parsed.typeOfWorkFilters ?? []);
      setDueFilter(parsed.dueFilter ?? "all");
      setSearchQuery(parsed.searchQuery ?? "");
      hasLoadedRef.current = true;
      persistFilters(activeView, {
        statusFilters: parsed.statusFilters ?? [],
        typeOfWorkFilters: parsed.typeOfWorkFilters ?? [],
        dueFilter: parsed.dueFilter ?? "all",
        searchQuery: parsed.searchQuery ?? "",
      });
    } catch (err) {
      console.warn("Failed to load inbox filters", err);
      setStatusFilters(allStatusFilterOptions);
      setTypeOfWorkFilters(allTypeFilterOptions);
      setDueFilter("all");
      setSearchQuery("");
      hasLoadedRef.current = true;
      persistFilters(activeView, {
        statusFilters: allStatusFilterOptions,
        typeOfWorkFilters: allTypeFilterOptions,
        dueFilter: "all",
        searchQuery: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, allStatusFilterOptions, allTypeFilterOptions]);

  const setStatusFiltersPersist = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setStatusFilters((prev) => {
        const resolved = typeof next === "function" ? (next as any)(prev) : next;
        persistFilters(activeView, { statusFilters: resolved });
        return resolved;
      });
    },
    [activeView, persistFilters]
  );

  const setTypeOfWorkFiltersPersist = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setTypeOfWorkFilters((prev) => {
        const resolved = typeof next === "function" ? (next as any)(prev) : next;
        persistFilters(activeView, { typeOfWorkFilters: resolved });
        return resolved;
      });
    },
    [activeView, persistFilters]
  );

  const setDueFilterPersist = useCallback(
    (next: "all" | "today" | "next-week") => {
      setDueFilter(next);
      persistFilters(activeView, { dueFilter: next });
    },
    [activeView, persistFilters]
  );

  const setSearchQueryPersist = useCallback(
    (next: string) => {
      setSearchQuery(next);
      persistFilters(activeView, { searchQuery: next });
    },
    [activeView, persistFilters]
  );

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
      const effectiveStatusFilters =
        statusFilters.length > 0 ? statusFilters : allStatusFilterOptions;
      const effectiveTypeFilters =
        typeOfWorkFilters.length > 0 ? typeOfWorkFilters : allTypeFilterOptions;

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

      if (view === "week" || view === "kanban") {
        result = result.filter((story) => effectiveStatusFilters.includes(story.status));
        result = result.filter((story) => {
          const value = story.typeOfWork?.trim();
          if (!value) return effectiveTypeFilters.includes("__unassigned__");
          return effectiveTypeFilters.includes(value);
        });
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
    setStatusFilters: setStatusFiltersPersist,
    typeOfWorkFilters,
    setTypeOfWorkFilters: setTypeOfWorkFiltersPersist,
    dueFilter,
    setDueFilter: setDueFilterPersist,
    searchQuery,
    setSearchQuery: setSearchQueryPersist,
    allStatusFilterOptions,
    allTypeFilterOptions,
    statusUsageCounts,
    typeUsageCounts,
    getFilteredStories,
    getStoryCounts,
  };
}

export default useInboxFilters;
