import { useState, useEffect } from "react";
import {
  Calendar,
  Flag,
  MoreHorizontal,
  Pencil,
  Check,
  X,
  MessageSquare,
  Paperclip,
  List,
} from "lucide-react";
import { Story, Epic } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TaskDetailProps {
  story: Story;
  epic?: Epic;
  onUpdateStory: (story: Story) => void;
}

export function TaskDetail({ story, epic, onUpdateStory }: TaskDetailProps) {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  useEffect(() => {
    setTitle(story.title);
    setDescription(story.description);
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  }, [story.id]);

  const saveTitle = () => {
    if (title.trim()) {
      onUpdateStory({ ...story, title: title.trim() });
      setIsEditingTitle(false);
    }
  };

  const saveDescription = () => {
    onUpdateStory({ ...story, description });
    setIsEditingDescription(false);
  };

  const isCompleted = story.status === 'done';
  const isOverdue = story.createdAt < new Date() && !isCompleted;

  return (
    <div className="w-96 bg-card border-l border-panel-border flex flex-col h-full shrink-0 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => {
              onUpdateStory({
                ...story,
                status: isCompleted ? 'todo' : 'done'
              });
            }}
            className="h-5 w-5"
          />
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className={cn(
              "text-sm font-medium",
              isOverdue ? "text-destructive" : "text-primary"
            )}>
              {format(story.createdAt, "d MMM")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const priorities: Story['priority'][] = ['low', 'medium', 'high'];
              const currentIndex = priorities.indexOf(story.priority);
              const nextIndex = (currentIndex + 1) % priorities.length;
              onUpdateStory({ ...story, priority: priorities[nextIndex] });
            }}
          >
            <Flag className={cn(
              "w-4 h-4",
              story.priority === 'high' && "text-destructive fill-destructive",
              story.priority === 'medium' && "text-yellow-500",
              story.priority === 'low' && "text-muted-foreground"
            )} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {/* Title */}
        <div className="mb-4 group">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold border-0 shadow-none focus-visible:ring-1 px-0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitle(story.title);
                    setIsEditingTitle(false);
                  }
                }}
                onBlur={saveTitle}
              />
            </div>
          ) : (
            <div 
              className="flex items-start gap-2 cursor-pointer"
              onClick={() => setIsEditingTitle(true)}
            >
              <h1 className={cn(
                "text-lg font-semibold leading-tight flex-1",
                isCompleted ? "text-muted-foreground line-through" : "text-foreground"
              )}>
                {story.title}
              </h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mb-6">
          {isEditingDescription ? (
            <div className="space-y-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-24 resize-none"
                placeholder="Add notes..."
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDescription}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDescription(story.description);
                    setIsEditingDescription(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingDescription(true)}
              className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {story.description || "Add notes..."}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-panel-border">
        {epic && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{epic.name}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
