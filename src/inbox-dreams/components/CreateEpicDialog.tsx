import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@inbox/components/ui/dialog";
import { Button } from "@inbox/components/ui/button";
import { Input } from "@inbox/components/ui/input";
import { Label } from "@inbox/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inbox/components/ui/select";
import { Textarea } from "@inbox/components/ui/textarea";
import { Epic } from "@inbox/types";

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEpic: (epic: Omit<Epic, "id" | "createdAt">) => void;
  usedColors?: string[];
  mode?: "create" | "edit";
  initialEpic?: Epic | null;
  onUpdateEpic?: (epicId: string, color: string) => void;
}

const colorOptions = [
  { value: "hsl(217, 91%, 60%)", label: "Skyfire" },
  { value: "hsl(0, 84%, 60%)", label: "Crimson Tide" },
  { value: "hsl(270, 70%, 60%)", label: "Violet Drift" },
  { value: "hsl(142, 70%, 45%)", label: "Emerald Glow" },
  { value: "hsl(25, 95%, 53%)", label: "Sunforge" },
  { value: "hsl(330, 80%, 60%)", label: "Neon Bloom" },
  { value: "hsl(199, 89%, 48%)", label: "Blue Nebula" },
  { value: "hsl(280, 82%, 50%)", label: "Royal Pulse" },
  { value: "hsl(210, 40%, 50%)", label: "Steel Harbor" },
  { value: "hsl(210, 10%, 45%)", label: "Slate Echo" },
  { value: "hsl(150, 45%, 45%)", label: "Fern Trail" },
  { value: "hsl(10, 80%, 55%)", label: "Lava Jet" },
  { value: "hsl(50, 90%, 55%)", label: "Saffron Ray" },
  { value: "hsl(120, 50%, 45%)", label: "Pine Ridge" },
  { value: "hsl(190, 70%, 45%)", label: "Glacier Bay" },
  { value: "hsl(230, 75%, 55%)", label: "Midnight Surf" },
  { value: "hsl(260, 60%, 55%)", label: "Iris Circuit" },
  { value: "hsl(300, 70%, 55%)", label: "Orchid Spark" },
  { value: "hsl(340, 70%, 55%)", label: "Rose Signal" },
  { value: "hsl(20, 85%, 55%)", label: "Copper Flame" },
  { value: "hsl(80, 70%, 45%)", label: "Lime Crest" },
];

export function CreateEpicDialog({
  open,
  onOpenChange,
  onCreateEpic,
  usedColors = [],
  mode = "create",
  initialEpic = null,
  onUpdateEpic,
}: CreateEpicDialogProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const availableColors = useMemo(
    () => colorOptions.filter((option) => !usedColors.includes(option.value)),
    [usedColors]
  );
  const fallbackColor = availableColors[0]?.value ?? colorOptions[0].value;
  const [color, setColor] = useState(fallbackColor);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialEpic) {
      setName(initialEpic.name);
      setKey(initialEpic.key);
      setDescription(initialEpic.description);
      setColor(initialEpic.color);
      return;
    }
    setName("");
    setKey("");
    setDescription("");
    setColor(fallbackColor);
  }, [open, fallbackColor, mode, initialEpic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    if (mode === "edit" && initialEpic && onUpdateEpic) {
      onUpdateEpic(initialEpic.id, color);
    } else {
      onCreateEpic({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim(),
        color,
        isStarred: false,
      });
    }

    setName("");
    setKey("");
    setDescription("");
    setColor(fallbackColor);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Update Epic" : "Create Epic"}</DialogTitle>
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
              disabled={mode === "edit"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => {
                const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                setKey(sanitized.slice(0, 3));
              }}
              placeholder="e.g., AUTH"
              maxLength={3}
              required
              disabled={mode === "edit"}
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
              disabled={mode === "edit"}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue placeholder="Select a color" />
              </SelectTrigger>
              <SelectContent>
                {(availableColors.length > 0 ? availableColors : colorOptions).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: option.value }}
                      />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{mode === "edit" ? "Update Epic" : "Create Epic"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
