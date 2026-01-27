import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrograms } from "@/hooks/usePrograms";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { Loader2, Plus, ArrowLeft, AlertCircle, Calendar, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Division {
  id: string;
  name: string;
  color: string | null;
}

interface Panchayath {
  id: string;
  name: string;
}

export default function ProgramsManagement() {
  const { programs, isLoading, refetch } = usePrograms();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filterDivision, setFilterDivision] = useState("all");

  // Form state
  const [programName, setProgramName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedPanchayath, setSelectedPanchayath] = useState("");
  const [allPanchayaths, setAllPanchayaths] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { adminData, isSuperAdmin, user, adminToken } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch divisions
      const { data: divData } = await supabase
        .from("divisions")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name");
      setDivisions(divData || []);

      // For regular admins, auto-select their division
      if (adminData && !isSuperAdmin) {
        setSelectedDivision(adminData.division_id);
      }

      // Fetch panchayaths
      const { data: panchData } = await supabase
        .from("panchayaths")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPanchayaths(panchData || []);
    };

    fetchData();
  }, [adminData, isSuperAdmin]);

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!selectedDivision) {
        throw new Error("Please select a division");
      }

      if (!allPanchayaths && !selectedPanchayath) {
        throw new Error("Please select a panchayath or enable 'All Panchayaths'");
      }

      // Check if we're using admin token or regular Supabase auth
      if (adminToken) {
        // Use edge function for admin token users
        const { data: response, error: funcError } = await supabase.functions.invoke("admin-programs", {
          body: {
            action: "create",
            data: {
              name: programName.trim(),
              description: description.trim() || null,
              division_id: selectedDivision,
              panchayath_id: allPanchayaths ? null : selectedPanchayath,
              all_panchayaths: allPanchayaths,
              start_date: startDate || null,
              end_date: endDate || null,
            },
          },
          headers: {
            "x-admin-token": adminToken,
          },
        });

        if (funcError) throw funcError;
        if (!response.success) throw new Error(response.error || "Failed to create program");
      } else {
        // Use direct Supabase for regular authenticated users (super admin)
        const createdBy = user?.id;
        if (!createdBy) {
          throw new Error("User not authenticated");
        }

        const { error: insertError } = await supabase.from("programs").insert({
          name: programName.trim(),
          description: description.trim() || null,
          division_id: selectedDivision,
          panchayath_id: allPanchayaths ? null : selectedPanchayath,
          all_panchayaths: allPanchayaths,
          start_date: startDate || null,
          end_date: endDate || null,
          created_by: createdBy,
        });

        if (insertError) throw insertError;
      }

      toast({
        title: "Program created",
        description: "New program has been added successfully.",
      });

      setIsDialogOpen(false);
      resetForm();
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to create program");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setProgramName("");
    setDescription("");
    if (isSuperAdmin) {
      setSelectedDivision("");
    }
    setSelectedPanchayath("");
    setAllPanchayaths(false);
    setStartDate("");
    setEndDate("");
    setError("");
  };

  const filteredPrograms =
    filterDivision === "all"
      ? programs
      : programs.filter((p) => p.division_id === filterDivision);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-4 md:py-8 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="golden" size="icon">
              <Link to="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-foreground truncate">Manage Programs</h1>
              <p className="text-sm text-muted-foreground">
                Create and manage programs for your division
              </p>
            </div>
          </div>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <Button onClick={() => setIsDialogOpen(true)} variant="golden" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Program
            </Button>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Program</DialogTitle>
                <DialogDescription>Add a new program to your division</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProgram} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="programName">Program Name *</Label>
                  <Input
                    id="programName"
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    placeholder="Enter program name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Program details..."
                    rows={3}
                  />
                </div>

                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="division">Division *</Label>
                    <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a division" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions.map((division) => (
                          <SelectItem key={division.id} value={division.id}>
                            {division.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    id="allPanchayaths"
                    checked={allPanchayaths}
                    onCheckedChange={setAllPanchayaths}
                  />
                  <Label htmlFor="allPanchayaths">Available in all panchayaths</Label>
                </div>

                {!allPanchayaths && (
                  <div className="space-y-2">
                    <Label htmlFor="panchayath">Panchayath *</Label>
                    <Select value={selectedPanchayath} onValueChange={setSelectedPanchayath}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a panchayath" />
                      </SelectTrigger>
                      <SelectContent>
                        {panchayaths.map((panchayath) => (
                          <SelectItem key={panchayath.id} value={panchayath.id}>
                            {panchayath.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} variant="golden" className="w-full sm:w-auto">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Program"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        {isSuperAdmin && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <Select value={filterDivision} onValueChange={setFilterDivision}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divisions</SelectItem>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredPrograms.length} program{filteredPrograms.length !== 1 ? "s" : ""} found
            </span>
          </div>
        )}

        {/* Programs Grid */}
        {filteredPrograms.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No programs found</p>
            <p className="text-sm">Create your first program to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} isAdmin />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
