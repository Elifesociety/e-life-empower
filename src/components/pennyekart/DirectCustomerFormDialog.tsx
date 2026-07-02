import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import type { AgentDirectCustomer, DirectCustomerInput } from "@/hooks/useAgentDirectCustomers";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile must be exactly 10 digits"),
  ward: z.string().trim().min(1, "Ward is required").max(50, "Ward too long"),
  panchayath_id: z.string().uuid("Panchayath is required"),
  is_outside: z.boolean(),
  address: z.string().trim().max(300, "Address too long").optional(),
  notes: z.string().trim().max(500, "Notes too long").optional(),
});

interface DirectCustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomer?: AgentDirectCustomer | null;
  onSubmit: (data: DirectCustomerInput) => Promise<{ error: string | null }>;
  defaultPanchayathId?: string | null;
  defaultPanchayathName?: string | null;
  defaultWard?: string | null;
}

export function DirectCustomerFormDialog({
  open,
  onOpenChange,
  initialCustomer,
  onSubmit,
  defaultPanchayathId,
  defaultPanchayathName,
  defaultWard,
}: DirectCustomerFormDialogProps) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [ward, setWard] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isOutside, setIsOutside] = useState(false);
  const [panchayathId, setPanchayathId] = useState<string>("");
  const [panchayaths, setPanchayaths] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const editingOutside = initialCustomer?.is_outside === true;
      setIsOutside(editingOutside);
      setName(initialCustomer?.name || "");
      setMobile(initialCustomer?.mobile || "");
      setWard(initialCustomer?.ward || (editingOutside ? "" : defaultWard || ""));
      setAddress(initialCustomer?.address || "");
      setNotes(initialCustomer?.notes || "");
      setPanchayathId(
        initialCustomer?.panchayath_id ||
          (editingOutside ? "" : defaultPanchayathId || "")
      );
    }
  }, [open, initialCustomer, defaultPanchayathId, defaultWard]);

  useEffect(() => {
    if (!open || !isOutside || panchayaths.length > 0) return;
    (async () => {
      const { data } = await supabase
        .from("panchayaths")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPanchayaths(data || []);
    })();
  }, [open, isOutside, panchayaths.length]);

  const handleToggleOutside = (checked: boolean) => {
    setIsOutside(checked);
    if (checked) {
      // Clear defaults so user picks manually
      if (!initialCustomer || !initialCustomer.is_outside) {
        setPanchayathId("");
        setWard("");
      }
    } else {
      // Restore agent defaults
      setPanchayathId(defaultPanchayathId || "");
      setWard(defaultWard || "");
    }
  };

  const handleSave = async () => {
    const parsed = schema.safeParse({
      name,
      mobile: mobile.replace(/\D/g, ""),
      ward,
      address,
      notes,
      panchayath_id: panchayathId,
      is_outside: isOutside,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await onSubmit(parsed.data as DirectCustomerInput);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(initialCustomer ? "Customer updated" : "Customer added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>{initialCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dc-name">Name *</Label>
              <Input id="dc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-mobile">Mobile *</Label>
              <Input
                id="dc-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                inputMode="numeric"
                placeholder="10-digit mobile"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2 gap-3">
            <div className="min-w-0">
              <Label htmlFor="dc-outside" className="cursor-pointer">Outside Location</Label>
              <p className="text-xs text-muted-foreground">Customer from a different panchayath</p>
            </div>
            <Switch id="dc-outside" checked={isOutside} onCheckedChange={handleToggleOutside} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Panchayath *</Label>
              {isOutside ? (
                <SearchableSelect
                  value={panchayathId}
                  onValueChange={setPanchayathId}
                  options={panchayaths.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Select panchayath"
                  searchPlaceholder="Search panchayath..."
                />
              ) : (
                <Input value={defaultPanchayathName || "—"} disabled />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-ward">Ward *</Label>
              <Input
                id="dc-ward"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                maxLength={50}
                placeholder={isOutside ? "Enter ward" : `Default: ${defaultWard || "—"}`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dc-address">Address</Label>
            <Textarea id="dc-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-notes">Notes</Label>
            <Textarea id="dc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {initialCustomer ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}