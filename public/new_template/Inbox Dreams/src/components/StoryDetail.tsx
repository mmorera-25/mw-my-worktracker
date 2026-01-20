import { useState, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  Lock,
  Eye,
  Share2,
  MoreHorizontal,
  Plus,
  Settings,
  Link as LinkIcon,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Story, Epic, User } from "@/types";
import { UserAvatar } from "./UserAvatar";
import { EpicIcon } from "./EpicIcon";
import { StatusBadge } from "./StatusBadge";
import { PriorityIndicator } from "./PriorityIndicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { users as allUsers } from "@/data/mockData";

interface StoryDetailProps {
  story: Story;
  epic?: Epic;
  onUpdateStory: (story: Story) => void;
  onNavigate: (direction: "prev" | "next") => void;
}

export function StoryDetail({ story, epic, onUpdateStory, onNavigate }: StoryDetailProps) {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Reset local state when story changes
  useEffect(() => {
    setTitle(story.title);
    setDescription(story.description);
    setIsEditingTitle(false);
    setIsEditingDescription(false);
  }, [story.id]);

  const handleStatusChange = (status: string) => {
    onUpdateStory({ ...story, status: status as Story["status"] });
  };

  const handleAssigneeChange = (userId: string) => {
    const newAssignee = userId === "unassigned" ? undefined : allUsers.find((u) => u.id === userId);
    onUpdateStory({ ...story, assignee: newAssignee });
  };

  const handlePriorityChange = (priority: string) => {
    onUpdateStory({ ...story, priority: priority as Story["priority"] });
  };

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

  return (
    <div className="flex-1 bg-card flex flex-col h-full min-w-0 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <div className="flex items-center gap-2">
          {epic && <EpicIcon color={epic.color} size="sm" />}
          <span className="text-sm text-primary font-medium">{story.key}</span>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNavigate("prev")}>
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNavigate("next")}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Lock className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
            <Eye className="w-3 h-3" />
            <span>4</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6">
          {/* Title */}
          <div className="flex items-start gap-3 mb-6 group">
            {epic && (
              <div
                className="w-6 h-6 rounded shrink-0 mt-1"
                style={{ backgroundColor: epic.color }}
              />
            )}
            {isEditingTitle ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") {
                      setTitle(story.title);
                      setIsEditingTitle(false);
                    }
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveTitle}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setTitle(story.title);
                    setIsEditingTitle(false);
                  }}
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground leading-tight">
                  {story.title}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mb-8">
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* Fields */}
          <div className="space-y-6">
            {/* Assignee */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm text-muted-foreground">Assignee</span>
              <div className="col-span-2">
                <Select
                  value={story.assignee?.id || "unassigned"}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {story.assignee ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar user={story.assignee} size="sm" />
                          <span>{story.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <UserAvatar user={user} size="sm" />
                          <span>{user.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {story.assignee && (
                  <button className="text-sm text-primary hover:underline mt-1">
                    Assign to me
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="col-span-2">
                <Select value={story.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      <StatusBadge status={story.status} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm text-muted-foreground">Priority</span>
              <div className="col-span-2">
                <Select value={story.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      <PriorityIndicator priority={story.priority} showLabel />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Epic */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm text-muted-foreground">Epic</span>
              <div className="col-span-2 flex items-center gap-2">
                {epic && (
                  <>
                    <EpicIcon color={epic.color} size="sm" />
                    <span className="text-sm font-medium">{epic.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="pt-4 border-t border-panel-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Description</h3>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24"
                    placeholder="Add a description..."
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
                  className="w-full text-left p-3 rounded-md border border-dashed border-panel-border hover:border-primary/50 hover:bg-hover-overlay transition-colors text-sm text-muted-foreground"
                >
                  {story.description || "Add a description..."}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
