import DataStoragePanel from "../../features/settings/DataStoragePanel";
import type { WorkflowConfig } from "../lib/settings/configRepository";
import SimplePage from "./SimplePage";

type SettingsPageProps = {
  workflow: WorkflowConfig;
  onUpdateWorkflow: (next: WorkflowConfig) => void | Promise<void>;
  onStorageReady: () => void;
  requiresStorageSetup: boolean;
  typeOfWorkOptions: string[];
  onPersistTypeOfWorkOptions: (next: string[]) => void | Promise<void>;
  statusUsageCounts: Record<string, number>;
  typeUsageCounts: Record<string, number>;
};

const SettingsPage = ({
  workflow,
  onUpdateWorkflow,
  onStorageReady,
  requiresStorageSetup,
  typeOfWorkOptions,
  onPersistTypeOfWorkOptions,
  statusUsageCounts,
  typeUsageCounts,
}: SettingsPageProps) => {
  return (
    <SimplePage title="Settings">
      <DataStoragePanel
        workflow={workflow}
        onUpdateWorkflow={onUpdateWorkflow}
        onStorageReady={onStorageReady}
        requiresStorageSetup={requiresStorageSetup}
        typeOfWorkOptions={typeOfWorkOptions}
        onPersistTypeOfWorkOptions={onPersistTypeOfWorkOptions}
        statusUsageCounts={statusUsageCounts}
        typeUsageCounts={typeUsageCounts}
      />
    </SimplePage>
  );
};

export default SettingsPage;
