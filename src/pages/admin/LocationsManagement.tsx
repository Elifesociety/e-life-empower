import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, ArrowLeft, AlertCircle, MapPin, Building, Pencil, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/hooks/useAuth";

interface Panchayath {
  id: string;
  name: string;
  name_ml: string | null;
  district: string | null;
  state: string | null;
  ward: string | null;
  code: string | null;
  is_active: boolean | null;
  created_at: string | null;
}


interface Cluster {
  id: string;
  name: string;
  name_ml: string | null;
  panchayath_id: string;
  is_active: boolean | null;
  created_at: string | null;
  panchayath?: {
    name: string;
  };
}

interface District {
  id: string;
  state: string;
  name: string;
  is_active: boolean | null;
}

export default function LocationsManagement() {
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanchayathDialogOpen, setIsPanchayathDialogOpen] = useState(false);
  const [isClusterDialogOpen, setIsClusterDialogOpen] = useState(false);
  const [isDistrictDialogOpen, setIsDistrictDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingPanchayath, setEditingPanchayath] = useState<Panchayath | null>(null);

  // Panchayath filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Panchayath form state
  const [panchayathName, setPanchayathName] = useState("");
  const [panchayathNameMl, setPanchayathNameMl] = useState("");
  const [panchayathDistrict, setPanchayathDistrict] = useState("Malappuram");
  const [panchayathWard, setPanchayathWard] = useState<number | "">("");
  const [panchayathState, setPanchayathState] = useState("Kerala");
  const [panchayathCode, setPanchayathCode] = useState("");

  // District form state
  const [newDistrictState, setNewDistrictState] = useState("Kerala");
  const [newDistrictName, setNewDistrictName] = useState("");

  // Cluster form state
  const [clusterName, setClusterName] = useState("");
  const [clusterNameMl, setClusterNameMl] = useState("");
  const [selectedPanchayath, setSelectedPanchayath] = useState("");

  const { toast } = useToast();
  const { adminToken } = useAuth();

  const fetchPanchayaths = async () => {
    // Use edge function for admin-token sessions
    if (adminToken) {
      try {
        const response = await supabase.functions.invoke("admin-locations", {
          headers: { "x-admin-token": adminToken },
          body: null,
        });
        
        if (response.error) {
          console.error("Error fetching panchayaths via edge function:", response.error);
          return;
        }
        
        setPanchayaths(response.data?.data || []);
      } catch (err) {
        console.error("Error fetching panchayaths:", err);
      }
      return;
    }

    // Fallback to direct query for Supabase-authenticated users
    const { data, error } = await supabase
      .from("panchayaths")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching panchayaths:", error);
      return;
    }

    setPanchayaths(data || []);
  };

  const fetchClusters = async () => {
    // Use edge function for admin-token sessions
    if (adminToken) {
      try {
        const response = await supabase.functions.invoke("admin-locations?resource=clusters", {
          headers: { "x-admin-token": adminToken },
          body: null,
        });
        
        if (response.error) {
          console.error("Error fetching clusters via edge function:", response.error);
          return;
        }
        
        setClusters(response.data?.data || []);
      } catch (err) {
        console.error("Error fetching clusters:", err);
      }
      return;
    }

    // Fallback to direct query for Supabase-authenticated users
    const { data, error } = await supabase
      .from("clusters")
      .select(`
        *,
        panchayath:panchayaths(name)
      `)
      .order("name");

    if (error) {
      console.error("Error fetching clusters:", error);
      return;
    }

    setClusters(data || []);
  };

  const fetchDistricts = async () => {
    // Districts are publicly readable; use direct client to avoid needing admin token
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .order("state")
      .order("name");

    if (error) {
      console.error("Error fetching districts:", error);
      return;
    }
    setDistricts(data || []);
  };

  const handleCreateDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const stateVal = newDistrictState.trim();
      const nameVal = newDistrictName.trim();
      if (!stateVal || !nameVal) throw new Error("State and district name are required");

      if (adminToken) {
        const response = await supabase.functions.invoke(
          "admin-locations?resource=districts&action=create",
          {
            headers: { "x-admin-token": adminToken },
            body: { state: stateVal, name: nameVal },
            method: "POST",
          }
        );
        if (response.error) throw new Error(response.error.message);
      } else {
        const { error: insertError } = await supabase
          .from("districts")
          .insert({ state: stateVal, name: nameVal });
        if (insertError) throw insertError;
      }

      toast({ title: "District added", description: `${nameVal}, ${stateVal}` });
      setNewDistrictName("");
      setIsDistrictDialogOpen(false);
      await fetchDistricts();
      // Auto-select the newly created district in the panchayath form
      setPanchayathState(stateVal);
      setPanchayathDistrict(nameVal);
    } catch (err: any) {
      const msg = err?.message || "Failed to add district";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchPanchayaths(), fetchClusters(), fetchDistricts()]);
      setIsLoading(false);
    };
    loadData();
  }, [adminToken]);

  const handlePanchayathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const panchayathData = {
        name: panchayathName.trim(),
        name_ml: panchayathNameMl.trim() || null,
        district: panchayathDistrict.trim() || null,
        ward: panchayathWard ? String(panchayathWard) : null,
        state: panchayathState.trim() || "Kerala",
        code: panchayathCode.trim() || null,
      };

      if (editingPanchayath) {
        // Update existing
        if (adminToken) {
          const response = await supabase.functions.invoke("admin-locations?resource=panchayaths&action=update", {
            method: "PATCH",
            headers: { "x-admin-token": adminToken },
            body: { id: editingPanchayath.id, ...panchayathData },
          });

          if (response.error) throw new Error(response.error.message);
        } else {
          const { error: updateError } = await supabase
            .from("panchayaths")
            .update(panchayathData)
            .eq("id", editingPanchayath.id);

          if (updateError) throw updateError;
        }

        toast({
          title: "Panchayath updated",
          description: "Panchayath details have been updated successfully.",
        });
      } else {
        // Create new
        if (adminToken) {
          const response = await supabase.functions.invoke("admin-locations?resource=panchayaths&action=create", {
            method: "POST",
            headers: { "x-admin-token": adminToken },
            body: panchayathData,
          });

          if (response.error) throw new Error(response.error.message);
        } else {
          const { error: insertError } = await supabase
            .from("panchayaths")
            .insert(panchayathData);

          if (insertError) throw insertError;
        }

        toast({
          title: "Panchayath created",
          description: "New panchayath has been added successfully.",
        });
      }

      setIsPanchayathDialogOpen(false);
      resetPanchayathForm();
      fetchPanchayaths();
    } catch (err: any) {
      setError(err.message || (editingPanchayath ? "Failed to update panchayath" : "Failed to create panchayath"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!selectedPanchayath) {
        throw new Error("Please select a panchayath");
      }

      const clusterData = {
        name: clusterName.trim(),
        name_ml: clusterNameMl.trim() || null,
        panchayath_id: selectedPanchayath,
      };

      if (adminToken) {
        const response = await supabase.functions.invoke("admin-locations?resource=clusters&action=create", {
          method: "POST",
          headers: { "x-admin-token": adminToken },
          body: clusterData,
        });
        
        if (response.error) throw new Error(response.error.message);
      } else {
        const { error: insertError } = await supabase
          .from("clusters")
          .insert(clusterData);

        if (insertError) throw insertError;
      }

      toast({
        title: "Cluster created",
        description: "New cluster has been added successfully.",
      });

      setIsClusterDialogOpen(false);
      resetClusterForm();
      fetchClusters();
    } catch (err: any) {
      setError(err.message || "Failed to create cluster");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPanchayathForm = () => {
    setPanchayathName("");
    setPanchayathNameMl("");
    setPanchayathDistrict("Malappuram");
    setPanchayathWard("");
    setPanchayathState("Kerala");
    setPanchayathCode("");
    setEditingPanchayath(null);
    setError("");
  };

  const openEditDialog = (panchayath: Panchayath) => {
    setPanchayathName(panchayath.name);
    setPanchayathNameMl(panchayath.name_ml || "");
    setPanchayathDistrict(panchayath.district || "");
    setPanchayathWard(panchayath.ward ? Number(panchayath.ward) : "");
    setPanchayathState(panchayath.state || "Kerala");
    setPanchayathCode(panchayath.code || "");
    setEditingPanchayath(panchayath);
    setIsPanchayathDialogOpen(true);
  };


  const resetClusterForm = () => {
    setClusterName("");
    setClusterNameMl("");
    setSelectedPanchayath("");
    setError("");
  };

  const togglePanchayathStatus = async (id: string, currentStatus: boolean) => {
    try {
      if (adminToken) {
        const response = await supabase.functions.invoke("admin-locations?resource=panchayaths&action=update", {
          method: "PATCH",
          headers: { "x-admin-token": adminToken },
          body: { id, is_active: !currentStatus },
        });
        
        if (response.error) throw response.error;
      } else {
        const { error } = await supabase
          .from("panchayaths")
          .update({ is_active: !currentStatus })
          .eq("id", id);

        if (error) throw error;
      }

      toast({
        title: "Status updated",
        description: `Panchayath has been ${!currentStatus ? "activated" : "deactivated"}.`,
      });

      fetchPanchayaths();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update panchayath status",
        variant: "destructive",
      });
    }
  };

  const toggleClusterStatus = async (id: string, currentStatus: boolean) => {
    try {
      if (adminToken) {
        const response = await supabase.functions.invoke("admin-locations?resource=clusters&action=update", {
          method: "PATCH",
          headers: { "x-admin-token": adminToken },
          body: { id, is_active: !currentStatus },
        });
        
        if (response.error) throw response.error;
      } else {
        const { error } = await supabase
          .from("clusters")
          .update({ is_active: !currentStatus })
          .eq("id", id);

        if (error) throw error;
      }

      toast({
        title: "Status updated",
        description: `Cluster has been ${!currentStatus ? "activated" : "deactivated"}.`,
      });

      fetchClusters();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update cluster status",
        variant: "destructive",
      });
    }
  };

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
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Manage Locations</h1>
            <p className="text-muted-foreground">
              Manage panchayaths, clusters, and geographical hierarchy
            </p>
          </div>
        </div>

        <Tabs defaultValue="panchayaths" className="space-y-6">
          <TabsList>
            <TabsTrigger value="panchayaths" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Panchayaths
            </TabsTrigger>
            <TabsTrigger value="districts" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Districts
            </TabsTrigger>
            <TabsTrigger value="clusters" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Clusters
            </TabsTrigger>
          </TabsList>

          {/* Panchayaths Tab */}
          <TabsContent value="panchayaths">
            <div className="flex justify-end mb-4">
              <Dialog open={isPanchayathDialogOpen} onOpenChange={(open) => {
                setIsPanchayathDialogOpen(open);
                if (!open) resetPanchayathForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Panchayath
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingPanchayath ? "Edit Panchayath" : "Add New Panchayath"}</DialogTitle>
                    <DialogDescription>
                      {editingPanchayath ? "Update panchayath details" : "Add a new panchayath with ward details"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePanchayathSubmit} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="panchayathName">Name (English)</Label>
                      <Input
                        id="panchayathName"
                        value={panchayathName}
                        onChange={(e) => setPanchayathName(e.target.value)}
                        placeholder="Panchayath name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="panchayathNameMl">Name (Malayalam)</Label>
                      <Input
                        id="panchayathNameMl"
                        value={panchayathNameMl}
                        onChange={(e) => setPanchayathNameMl(e.target.value)}
                        placeholder="പഞ്ചായത്ത് പേര്"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="panchayathState">State</Label>
                        <Select
                          value={panchayathState}
                          onValueChange={(v) => {
                            setPanchayathState(v);
                            // Reset district if it no longer exists in the new state
                            const stillValid = districts.some(
                              (d) => d.state === v && d.name === panchayathDistrict
                            );
                            if (!stillValid) setPanchayathDistrict("");
                          }}
                        >
                          <SelectTrigger id="panchayathState">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(new Set(districts.map((d) => d.state))).map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="panchayathDistrict">District</Label>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              setNewDistrictState(panchayathState || "Kerala");
                              setIsDistrictDialogOpen(true);
                            }}
                          >
                            + Add new
                          </Button>
                        </div>
                        <Select
                          value={panchayathDistrict}
                          onValueChange={setPanchayathDistrict}
                          disabled={!panchayathState}
                        >
                          <SelectTrigger id="panchayathDistrict">
                            <SelectValue placeholder="Select district" />
                          </SelectTrigger>
                          <SelectContent>
                            {districts
                              .filter((d) => d.state === panchayathState && d.is_active !== false)
                              .map((d) => (
                                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="panchayathWard">Ward Count</Label>
                      <Input
                        id="panchayathWard"
                        type="number"
                        min="1"
                        value={panchayathWard}
                        onChange={(e) => setPanchayathWard(e.target.value ? Number(e.target.value) : "")}
                        placeholder="Number of wards (e.g., 25 means ward 1-25)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter total ward count. E.g., 25 means wards 1 to 25.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="panchayathCode">Panchayath Number / Code</Label>
                      <Input
                        id="panchayathCode"
                        value={panchayathCode}
                        onChange={(e) => setPanchayathCode(e.target.value)}
                        placeholder="e.g., LSGI code or custom number"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional. Manually enter the official panchayath number or code.
                      </p>
                    </div>


                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsPanchayathDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {editingPanchayath ? "Saving..." : "Creating..."}
                          </>
                        ) : (
                          editingPanchayath ? "Save Changes" : "Create Panchayath"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Name (ML)</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>State</TableHead>

            {/* Filters */}
            {(() => {
              const filteredPanchayaths = panchayaths.filter((p) => {
                const q = filterSearch.trim().toLowerCase();
                if (q && !(
                  (p.name || "").toLowerCase().includes(q) ||
                  (p.name_ml || "").toLowerCase().includes(q) ||
                  (p.code || "").toLowerCase().includes(q)
                )) return false;
                if (filterState !== "all" && (p.state || "Kerala") !== filterState) return false;
                if (filterDistrict !== "all" && (p.district || "") !== filterDistrict) return false;
                if (filterStatus === "active" && !p.is_active) return false;
                if (filterStatus === "inactive" && p.is_active) return false;
                return true;
              });
              const stateOptions = Array.from(new Set(panchayaths.map((p) => p.state || "Kerala")));
              const districtOptions = Array.from(
                new Set(
                  panchayaths
                    .filter((p) => filterState === "all" || (p.state || "Kerala") === filterState)
                    .map((p) => p.district || "")
                    .filter(Boolean)
                )
              );
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <Input
                      placeholder="Search name / code..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                    />
                    <Select value={filterState} onValueChange={(v) => { setFilterState(v); setFilterDistrict("all"); }}>
                      <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {stateOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                      <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {districtOptions.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Showing {filteredPanchayaths.length} of {panchayaths.length}
                    {(filterSearch || filterState !== "all" || filterDistrict !== "all" || filterStatus !== "all") && (
                      <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-xs" onClick={() => { setFilterSearch(""); setFilterState("all"); setFilterDistrict("all"); setFilterStatus("all"); }}>
                        Clear filters
                      </Button>
                    )}
                  </div>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Name (ML)</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>State</TableHead>

                    <TableHead>District</TableHead>
                    <TableHead>Ward</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPanchayaths.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No panchayaths match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPanchayaths.map((panchayath) => (
                      <TableRow key={panchayath.id}>
                        <TableCell className="font-medium">{panchayath.name}</TableCell>
                        <TableCell>{panchayath.name_ml || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{panchayath.code || "-"}</TableCell>
                        <TableCell>{panchayath.state || "Kerala"}</TableCell>

                        <TableCell>{panchayath.district || "-"}</TableCell>
                        <TableCell>{panchayath.ward || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              panchayath.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {panchayath.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(panchayath)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePanchayathStatus(panchayath.id, panchayath.is_active ?? true)}
                            >
                              {panchayath.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Districts Tab */}
          <TabsContent value="districts">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => {
                  setNewDistrictState("Kerala");
                  setNewDistrictName("");
                  setIsDistrictDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add District
              </Button>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Panchayaths</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No districts found. Add your first district to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    districts.map((d) => {
                      const count = panchayaths.filter(
                        (p) => p.state === d.state && p.district === d.name
                      ).length;
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.state}</TableCell>
                          <TableCell>{d.name}</TableCell>
                          <TableCell>{count}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                d.is_active !== false
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {d.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <Dialog open={isDistrictDialogOpen} onOpenChange={setIsDistrictDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New District</DialogTitle>
                  <DialogDescription>
                    Add a district under a state. It will become available when creating panchayaths.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateDistrict} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="newDistrictState">State</Label>
                    <Input
                      id="newDistrictState"
                      value={newDistrictState}
                      onChange={(e) => setNewDistrictState(e.target.value)}
                      placeholder="e.g., Kerala"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newDistrictName">District Name</Label>
                    <Input
                      id="newDistrictName"
                      value={newDistrictName}
                      onChange={(e) => setNewDistrictName(e.target.value)}
                      placeholder="e.g., Malappuram"
                      required
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDistrictDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add District"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Clusters Tab */}
          <TabsContent value="clusters">
            <div className="flex justify-end mb-4">
              <Dialog open={isClusterDialogOpen} onOpenChange={(open) => {
                setIsClusterDialogOpen(open);
                if (!open) resetClusterForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cluster
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Cluster</DialogTitle>
                    <DialogDescription>
                      Add a new cluster under a panchayath
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateCluster} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="clusterName">Name (English)</Label>
                      <Input
                        id="clusterName"
                        value={clusterName}
                        onChange={(e) => setClusterName(e.target.value)}
                        placeholder="Cluster name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clusterNameMl">Name (Malayalam)</Label>
                      <Input
                        id="clusterNameMl"
                        value={clusterNameMl}
                        onChange={(e) => setClusterNameMl(e.target.value)}
                        placeholder="ക്ലസ്റ്റർ പേര്"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="selectPanchayath">Panchayath</Label>
                      <SearchableSelect
                        options={panchayaths.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name }))}
                        value={selectedPanchayath}
                        onValueChange={setSelectedPanchayath}
                        placeholder="Select a panchayath"
                        searchPlaceholder="Search panchayath..."
                      />
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsClusterDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Cluster"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Name (ML)</TableHead>
                    <TableHead>Panchayath</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No clusters found. Add your first cluster to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clusters.map((cluster) => (
                      <TableRow key={cluster.id}>
                        <TableCell className="font-medium">{cluster.name}</TableCell>
                        <TableCell>{cluster.name_ml || "-"}</TableCell>
                        <TableCell>{cluster.panchayath?.name || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              cluster.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {cluster.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleClusterStatus(cluster.id, cluster.is_active ?? true)}
                          >
                            {cluster.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
