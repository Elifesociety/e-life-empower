import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Pencil, Plus, Trash2, X, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  note: string;
  note_date: string;
  author_name: string | null;
  author_mobile: string | null;
}

interface Props {
  panchayathId: string | null;
  panchayathName?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function PanchayathNotesDialog({ panchayathId, panchayathName, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const load = async () => {
    if (!panchayathId) return;
    setLoading(true);
    const { data } = await supabase
      .from("panchayath_notes")
      .select("id, note, note_date, author_name, author_mobile")
      .eq("panchayath_id", panchayathId)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false });
    setNotes((data as Note[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setText("");
      setEditingId(null);
      setSelectedDate(new Date());
      try {
        setAuthor(localStorage.getItem("elife_status_mobile") || "");
      } catch {
        setAuthor("");
      }
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panchayathId]);

  const save = async () => {
    if (!panchayathId || !text.trim()) return;
    setSaving(true);
    const mobile = author.replace(/\D/g, "") || null;
    if (editingId) {
      const { error } = await supabase
        .from("panchayath_notes")
        .update({ note: text.trim() })
        .eq("id", editingId);
      if (error) toast({ title: "Could not update note", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("panchayath_notes").insert({
        panchayath_id: panchayathId,
        note: text.trim(),
        note_date: today(),
        author_mobile: mobile,
        author_name: null,
      });
      if (error) toast({ title: "Could not add note", description: error.message, variant: "destructive" });
    }
    setSaving(false);
    setText("");
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("panchayath_notes").delete().eq("id", id);
    if (error) toast({ title: "Could not delete note", description: error.message, variant: "destructive" });
    load();
  };

  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      const arr = map.get(n.note_date) || [];
      arr.push(n);
      map.set(n.note_date, arr);
    }
    return map;
  }, [notes]);

  const noteDays = useMemo(() => Array.from(notesByDate.keys()).map(fromKey), [notesByDate]);
  const selectedKey = selectedDate ? toKey(selectedDate) : "";
  const dayNotes = notesByDate.get(selectedKey) || [];

  const renderNote = (n: Note, editable: boolean) => (
    <div key={n.id} className="rounded-md border-l-4 border-l-kerala-green bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge variant="secondary" className="text-[10px] font-mono">{n.note_date}</Badge>
        {editable && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(n.id); setText(n.note); }}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(n.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{n.note}</p>
      {n.author_mobile && (
        <p className="text-[11px] text-muted-foreground mt-1 font-mono">{n.author_mobile}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="w-4 h-4 text-kerala-green" />
            Updation Notes {panchayathName ? `· ${panchayathName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="today" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="today" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Today
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="w-3.5 h-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="flex-1 overflow-hidden flex flex-col mt-3 space-y-3">
            <div className="space-y-2 border rounded-lg p-3 bg-muted/40">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono text-[10px]">{today()}</Badge>
                <span>Today's note</span>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write an update note for this panchayath…"
                rows={3}
              />
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your mobile (optional)"
                className="h-8 text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving || !text.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  {editingId ? "Update note" : "Add note"}
                </Button>
                {editingId && (
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setText(""); }}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pt-1">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              ) : notes.filter((n) => n.note_date === today()).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notes today. Check the History tab for past notes.
                </p>
              ) : (
                notes.filter((n) => n.note_date === today()).map((n) => renderNote(n, true))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-y-auto mt-3 space-y-3">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{ hasNote: noteDays }}
                modifiersClassNames={{
                  hasNote: "font-bold text-kerala-green underline underline-offset-4",
                }}
                className={cn("p-3 pointer-events-auto rounded-md border")}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <span className="w-2 h-2 rounded-full bg-kerala-green" />
              <span>Days with notes ({noteDays.length})</span>
            </div>
            <div className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              ) : dayNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notes on {selectedKey || "the selected day"}.
                </p>
              ) : (
                dayNotes.map((n) => renderNote(n, n.note_date === today()))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
