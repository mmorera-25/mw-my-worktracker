import { useState, useCallback, useMemo } from "react";
import { IconSidebar } from "@/components/IconSidebar";
import { ListSidebar } from "@/components/ListSidebar";
import { TaskList } from "@/components/TaskList";
import { TaskDetail } from "@/components/TaskDetail";
import { EmptyState } from "@/components/EmptyState";
import { CreateEpicDialog } from "@/components/CreateEpicDialog";
import { CreateStoryDialog } from "@/components/CreateStoryDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { epics as initialEpics, stories as initialStories } from "@/data/mockData";
import { Epic, Story } from "@/types";

const Index = () => {
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState("week");
  const [isCreateEpicOpen, setIsCreateEpicOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);

  const selectedEpic = epics.find((e) => e.id === selectedEpicId);
  const selectedStory = stories.find((s) => s.id === selectedStoryId);

  const filteredStories = useMemo(() => {
    let result = stories;
    
    // Filter by view
    if (activeView === 'completed') {
      result = stories.filter((s) => s.status === 'done' && !s.isDeleted);
    } else if (activeView === 'trash') {
      result = stories.filter((s) => s.isDeleted);
    } else {
      // For other views, exclude deleted and completed
      result = stories.filter((s) => !s.isDeleted && s.status !== 'done');
    }
    
    // Filter by epic if selected
    if (selectedEpicId) {
      result = result.filter((s) => s.epicId === selectedEpicId);
    }
    
    return result;
  }, [stories, selectedEpicId, activeView]);

  const storyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    stories.filter(s => !s.isDeleted && s.status !== 'done').forEach((story) => {
      counts[story.epicId] = (counts[story.epicId] || 0) + 1;
    });
    return counts;
  }, [stories]);

  const handleSelectEpic = useCallback((epicId: string | null) => {
    setSelectedEpicId(epicId);
    if (epicId) {
      const epicStories = stories.filter((s) => s.epicId === epicId);
      if (epicStories.length > 0) {
        setSelectedStoryId(epicStories[0].id);
      } else {
        setSelectedStoryId(null);
      }
    }
  }, [stories]);

  const handleCreateEpic = useCallback((epicData: Omit<Epic, "id" | "createdAt">) => {
    const newEpic: Epic = {
      ...epicData,
      id: String(Date.now()),
      createdAt: new Date(),
    };
    setEpics((prev) => [...prev, newEpic]);
    setSelectedEpicId(newEpic.id);
  }, []);

  const handleCreateStory = useCallback(
    (storyData: Omit<Story, "id" | "key" | "createdAt">) => {
      const epic = epics.find((e) => e.id === storyData.epicId);
      const epicStoryCount = stories.filter((s) => s.epicId === storyData.epicId).length;
      const newStory: Story = {
        ...storyData,
        id: String(Date.now()),
        key: `${epic?.key || "TASK"}-${epicStoryCount + 100}`,
        createdAt: new Date(),
      };
      setStories((prev) => [...prev, newStory]);
      setSelectedStoryId(newStory.id);
    },
    [epics, stories]
  );

  const handleUpdateStory = useCallback((updatedStory: Story) => {
    // Add completedAt when marking as done
    if (updatedStory.status === 'done' && !updatedStory.completedAt) {
      updatedStory.completedAt = new Date();
    }
    setStories((prev) =>
      prev.map((s) => (s.id === updatedStory.id ? updatedStory : s))
    );
  }, []);

  const handleDeleteStory = useCallback((storyId: string) => {
    setStories((prev) =>
      prev.map((s) => 
        s.id === storyId 
          ? { ...s, isDeleted: true, deletedAt: new Date() } 
          : s
      )
    );
    if (selectedStoryId === storyId) {
      setSelectedStoryId(null);
    }
  }, [selectedStoryId]);

  const handleRestoreStory = useCallback((storyId: string) => {
    setStories((prev) =>
      prev.map((s) => 
        s.id === storyId 
          ? { ...s, isDeleted: false, deletedAt: undefined } 
          : s
      )
    );
  }, []);

  const handlePermanentDelete = useCallback((storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    if (selectedStoryId === storyId) {
      setSelectedStoryId(null);
    }
  }, [selectedStoryId]);

  const getViewTitle = () => {
    if (activeView === 'completed') return 'Completed';
    if (activeView === 'trash') return 'Trash';
    if (currentEpic) return currentEpic.name;
    return 'Next 7 Days';
  };

  const currentEpic = epics.find((e) => e.id === selectedEpicId);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Icon Sidebar */}
      <IconSidebar activeView={activeView} onViewChange={setActiveView} />

      {/* List Sidebar */}
      <ListSidebar
        epics={epics}
        selectedEpicId={selectedEpicId}
        onSelectEpic={handleSelectEpic}
        onCreateEpic={() => setIsCreateEpicOpen(true)}
        storyCounts={storyCounts}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* Task List */}
      <TaskList
        stories={filteredStories}
        epics={epics}
        selectedStoryId={selectedStoryId}
        onSelectStory={setSelectedStoryId}
        onCreateStory={() => setIsCreateStoryOpen(true)}
        onUpdateStory={handleUpdateStory}
        onDeleteStory={handleDeleteStory}
        onRestoreStory={handleRestoreStory}
        onPermanentDelete={handlePermanentDelete}
        viewTitle={getViewTitle()}
        activeView={activeView}
      />

      {/* Task Detail */}
      {selectedStory ? (
        <TaskDetail
          story={selectedStory}
          epic={epics.find((e) => e.id === selectedStory.epicId)}
          onUpdateStory={handleUpdateStory}
        />
      ) : (
        <div className="w-96 bg-card border-l border-panel-border flex items-center justify-center">
          <EmptyState
            title="No task selected"
            description="Select a task to view details"
          />
        </div>
      )}

      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle />
      </div>

      {/* Dialogs */}
      <CreateEpicDialog
        open={isCreateEpicOpen}
        onOpenChange={setIsCreateEpicOpen}
        onCreateEpic={handleCreateEpic}
      />
      <CreateStoryDialog
        open={isCreateStoryOpen}
        onOpenChange={setIsCreateStoryOpen}
        epics={epics}
        selectedEpicId={selectedEpicId || undefined}
        onCreateStory={handleCreateStory}
      />
    </div>
  );
};

export default Index;
