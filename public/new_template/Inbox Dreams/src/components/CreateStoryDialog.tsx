import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Epic, Story, User } from "@/types";
import { EpicIcon } from "./EpicIcon";
import { UserAvatar } from "./UserAvatar";
import { users as allUsers } from "@/data/mockData";

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epics: Epic[];
  selectedEpicId?: string;
  onCreateStory: (story: Omit<Story, "id" | "key" | "createdAt">) => void;
}

export function CreateStoryDialog({
  open,
  onOpenChange,
  epics,
  selectedEpicId,
  onCreateStory,
}: CreateStoryDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epicId, setEpicId] = useState(selectedEpicId || "");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<Story["priority"]>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !epicId) return;

    const assignee = assigneeId ? allUsers.find((u) => u.id === assigneeId) : undefined;

    onCreateStory({
      title: title.trim(),
      description: description.trim(),
      epicId,
      assignee,
      status: "todo",
      priority,
    });

    setTitle("");
    setDescription("");
    setEpicId(selectedEpicId || "");
    setAssigneeId("");
    setPriority("medium");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="epic">Epic</Label>
            <Select value={epicId} onValueChange={setEpicId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select an epic" />
              </SelectTrigger>
              <SelectContent>
                {epics.map((epic) => (
                  <SelectItem key={epic.id} value={epic.id}>
                    <div className="flex items-center gap-2">
                      <EpicIcon color={epic.color} size="sm" />
                      <span>{epic.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Story["priority"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Story</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
