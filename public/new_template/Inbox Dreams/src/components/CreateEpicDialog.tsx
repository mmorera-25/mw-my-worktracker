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
import { Epic } from "@/types";

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEpic: (epic: Omit<Epic, "id" | "createdAt">) => void;
}

const colorOptions = [
  "hsl(217, 91%, 60%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 70%, 60%)",
  "hsl(142, 70%, 45%)",
  "hsl(25, 95%, 53%)",
  "hsl(330, 80%, 60%)",
];

export function CreateEpicDialog({ open, onOpenChange, onCreateEpic }: CreateEpicDialogProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(colorOptions[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    onCreateEpic({
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description: description.trim(),
      color,
      isStarred: false,
    });

    setName("");
    setKey("");
    setDescription("");
    setColor(colorOptions[0]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Epic</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., User Authentication"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g., AUTH"
              maxLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              A unique identifier for this epic (used in story IDs)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this epic about?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-md transition-all ${
                    color === c ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Epic</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
