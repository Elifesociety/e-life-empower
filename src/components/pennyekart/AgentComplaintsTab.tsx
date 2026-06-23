import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, MessageSquareWarning, Search, Eye } from "lucide-react";
import { toast } from "sonner";

interface Complaint {
  id: string;
  agent_id: string;
  complaint_text: string;
  status: string;
  admin_remarks: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  agent?: { name: string; mobile: string; role: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  resolved: "bg-green-100 text-green-800 border-green-300",
  dismissed: "bg-red-100 text-red-800 border-red-300",
};

const ROLE_LABELS: Record<string, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO",
};

export function AgentComplaintsTab() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [remarks, setRemarks] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    let query = supabase
      .from("agent_complaints")
      .select("*, agent:pennyekart_agents(name, mobile, role)")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load complaints");
    } else {
      setComplaints((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter]);

  const handleUpdate = async () => {
    if (!selectedComplaint || !newStatus) return;
    setSaving(true);
    const { error } = await supabase
      .from("agent_complaints")
      .update({
        status: newStatus,
        admin_remarks: remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedComplaint.id);

    if (error) {
      setSaving(false);
      toast.error("Failed to update complaint");
      return;
    }

    // Send WhatsApp feedback to agent
    try {
      await supabase.functions.invoke("complaint-feedback", {
        body: {
          complaint_id: selectedComplaint.id,
          status: newStatus,
          admin_remarks: remarks || null,
        },
      });
      toast.success("Complaint updated & feedback sent to agent via WhatsApp");
    } catch {
      toast.success("Complaint updated (WhatsApp feedback could not be sent)");
    }

    setSaving(false);
    setSelectedComplaint(null);
    fetchComplaints();
  };

  const openDetail = (c: Complaint) => {
    setSelectedComplaint(c);
    setRemarks(c.admin_remarks || "");
    setNewStatus(c.status);
  };

  const filtered = complaints.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.agent?.name?.toLowerCase().includes(s) ||
      c.agent?.mobile?.includes(s) ||
      c.complaint_text.toLowerCase().includes(s)
    );
  });

  const pendingCount = complaints.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-destructive" />
            Agent Complaints
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agent name, mobile, or complaint..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No complaints found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Complaint</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{c.agent?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{c.agent?.mobile}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {ROLE_LABELS[c.agent?.role || ""] || c.agent?.role}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {c.complaint_text}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ""}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDetail(c)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail / Update Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={(o) => !o && setSelectedComplaint(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complaint Details</DialogTitle>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Agent</p>
                <p className="text-sm font-medium">
                  {selectedComplaint.agent?.name} ({ROLE_LABELS[selectedComplaint.agent?.role || ""] || selectedComplaint.agent?.role})
                </p>
                <p className="text-xs text-muted-foreground">{selectedComplaint.agent?.mobile}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm">{new Date(selectedComplaint.created_at).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Complaint</p>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{selectedComplaint.complaint_text}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Admin Remarks</p>
                <Textarea
                  placeholder="Add remarks..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedComplaint(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
