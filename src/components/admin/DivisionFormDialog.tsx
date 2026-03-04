import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface DivisionFormData {
  name: string;
  name_ml: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
}

interface DivisionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DivisionFormData) => Promise<void>;
  initialData?: Partial<DivisionFormData> & { id?: string };
  mode?: "create" | "edit";
}

export function DivisionFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "create",
}: DivisionFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<DivisionFormData>({
    name: "",
    name_ml: "",
    description: "",
    color: "",
    icon: "",
    is_active: true,
  });

  useEffect(() => {
    if (open && initialData) {
      setForm({
        name: initialData.name || "",
        name_ml: initialData.name_ml || "",
        description: initialData.description || "",
        color: initialData.color || "",
        icon: initialData.icon || "",
        is_active: initialData.is_active ?? true,
      });
    } else if (open) {
      setForm({ name: "", name_ml: "", description: "", color: "", icon: "", is_active: true });
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Division" : "Edit Division"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new division in the system."
              : "Update division details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="div-name">Name *</Label>
            <Input
              id="div-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Farmelife"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="div-name-ml">Name (Malayalam)</Label>
            <Input
              id="div-name-ml"
              value={form.name_ml}
              onChange={(e) => setForm((f) => ({ ...f, name_ml: e.target.value }))}
              placeholder="മലയാളം പേര്"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="div-desc">Description</Label>
            <Textarea
              id="div-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the division"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="div-color">Color</Label>
              <Input
                id="div-color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="#22c55e"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="div-icon">Icon</Label>
              <Input
                id="div-icon"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="e.g. leaf"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="div-active">Active</Label>
            <Switch
              id="div-active"
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "create" ? "Create Division" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
