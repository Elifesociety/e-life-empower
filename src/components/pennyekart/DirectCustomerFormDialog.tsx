import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { AgentDirectCustomer, DirectCustomerInput } from "@/hooks/useAgentDirectCustomers";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile must be exactly 10 digits"),
  ward: z.string().trim().max(50, "Ward too long").optional(),
  address: z.string().trim().max(300, "Address too long").optional(),
  notes: z.string().trim().max(500, "Notes too long").optional(),
});

interface DirectCustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomer?: AgentDirectCustomer | null;
  onSubmit: (data: DirectCustomerInput) => Promise<{ error: string | null }>;
}

export function DirectCustomerFormDialog({ open, onOpenChange, initialCustomer, onSubmit }: DirectCustomerFormDialogProps) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [ward, setWard] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialCustomer?.name || "");
      setMobile(initialCustomer?.mobile || "");
      setWard(initialCustomer?.ward || "");
      setAddress(initialCustomer?.address || "");
      setNotes(initialCustomer?.notes || "");
    }
  }, [open, initialCustomer]);

  const handleSave = async () => {
    const parsed = schema.safeParse({ name, mobile: mobile.replace(/\D/g, ""), ward, address, notes });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await onSubmit(parsed.data);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
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
          <div className="space-y-1.5">
            <Label htmlFor="dc-ward">Ward</Label>
            <Input id="dc-ward" value={ward} onChange={(e) => setWard(e.target.value)} maxLength={50} />
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
        <DialogFooter>
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