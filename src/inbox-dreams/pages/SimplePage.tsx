import { ReactNode } from "react";

type SimplePageProps = {
  title: string;
  children: ReactNode;
};

const SimplePage = ({ title, children }: SimplePageProps) => {
  return (
    <div className="flex-1 bg-background flex flex-col h-full min-w-0">
      <div className="px-6 py-4 border-b border-panel-border">
        <div className="text-lg font-semibold text-foreground">{title}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
};

export default SimplePage;
