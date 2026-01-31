import { useCallback, useEffect, useMemo, useState } from "react";
import { loadDb, persistDb } from "../../lib/storage/dbManager";
import {
  loadWorkflowConfig,
  saveWorkflowConfig,
  normalizeKanbanBuckets,
  type WorkflowConfig,
  type KanbanBucket,
} from "../../lib/settings/configRepository";
import { setAccentColor } from "../../theme/applyTheme";

const DEFAULT_WORKFLOW_COLUMNS = [
  "Backlog",
  "Scheduled",
  "On Hold / Waiting",
  "New",
  "To Ask",
  "To Do",
  "Done",
] as const;

type UseWorkflowConfigResult = {
  workflow: WorkflowConfig;
  setWorkflowConfig: (
    next: WorkflowConfig | ((prev: WorkflowConfig) => WorkflowConfig)
  ) => Promise<void>;
  reloadWorkflow: () => Promise<void>;
  doneStatus: string;
  defaultStatus: string;
  kanbanBuckets: Record<string, KanbanBucket>;
};

/**
 * Centralizes workflow configuration loading/saving and derived values.
 */
export function useWorkflowConfig(): UseWorkflowConfigResult {
  const [workflow, setWorkflow] = useState<WorkflowConfig>({
    columns: [...DEFAULT_WORKFLOW_COLUMNS],
    swimlanes: ["Core", "Enablement", "Bugs"],
    accent: "indigo",
    kanbanStatusBuckets: normalizeKanbanBuckets([...DEFAULT_WORKFLOW_COLUMNS], null),
  });

  const applyAccent = useCallback((accent: string | undefined) => {
    if (accent === "teal") setAccentColor("#14B8A6");
    else setAccentColor("#6366F1");
  }, []);

  const loadWorkflow = useCallback(async () => {
    const ctx = await loadDb();
    const cfg = loadWorkflowConfig(ctx.db);
    setWorkflow(cfg);
    applyAccent(cfg.accent);
  }, [applyAccent]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const setWorkflowConfig = useCallback(
    async (next: WorkflowConfig | ((prev: WorkflowConfig) => WorkflowConfig)) => {
      setWorkflow((prev) => {
        const resolved = typeof next === "function" ? (next as any)(prev) : next;
        applyAccent(resolved.accent);
        // fire-and-forget persistence
        (async () => {
          const ctx = await loadDb();
          saveWorkflowConfig(ctx.db, resolved);
          await persistDb(ctx);
        })();
        return resolved;
      });
    },
    [applyAccent]
  );

  const reloadWorkflow = useCallback(async () => {
    await loadWorkflow();
  }, [loadWorkflow]);

  const doneStatus = useMemo(() => {
    if (workflow.columns.length > 0) {
      return workflow.columns[workflow.columns.length - 1];
    }
    return "Done";
  }, [workflow.columns]);

  const defaultStatus = useMemo(() => {
    if (workflow.columns.includes("New")) return "New";
    return workflow.columns[0] ?? "Backlog";
  }, [workflow.columns]);

  const kanbanBuckets = useMemo(
    () => normalizeKanbanBuckets(workflow.columns, workflow.kanbanStatusBuckets),
    [workflow.columns, workflow.kanbanStatusBuckets]
  );

  return {
    workflow,
    setWorkflowConfig,
    reloadWorkflow,
    doneStatus,
    defaultStatus,
    kanbanBuckets,
  };
}

export default useWorkflowConfig;
