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
import { Loader2, Plus, ArrowLeft, AlertCircle, MapPin, Building } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Panchayath {
  id: string;
  name: string;
  name_ml: string | null;
  district: string | null;
  state: string | null;
  ward: string | null;
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

export default function LocationsManagement() {
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanchayathDialogOpen, setIsPanchayathDialogOpen] = useState(false);
  const [isClusterDialogOpen, setIsClusterDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Panchayath form state
  const [panchayathName, setPanchayathName] = useState("");
  const [panchayathNameMl, setPanchayathNameMl] = useState("");
  const [panchayathDistrict, setPanchayathDistrict] = useState("");
  const [panchayathWard, setPanchayathWard] = useState("");
  const [panchayathState, setPanchayathState] = useState("Kerala");

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

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchPanchayaths(), fetchClusters()]);
      setIsLoading(false);
    };
    loadData();
  }, [adminToken]);

  const handleCreatePanchayath = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const panchayathData = {
        name: panchayathName.trim(),
        name_ml: panchayathNameMl.trim() || null,
        district: panchayathDistrict.trim() || null,
        ward: panchayathWard.trim() || null,
        state: panchayathState.trim() || "Kerala",
      };

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

      setIsPanchayathDialogOpen(false);
      resetPanchayathForm();
      fetchPanchayaths();
    } catch (err: any) {
      setError(err.message || "Failed to create panchayath");
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
    setPanchayathDistrict("");
    setPanchayathWard("");
    setPanchayathState("Kerala");
    setError("");
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
                    <DialogTitle>Add New Panchayath</DialogTitle>
                    <DialogDescription>
                      Add a new panchayath with ward details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePanchayath} className="space-y-4">
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
                        <Input
                          id="panchayathState"
                          value={panchayathState}
                          onChange={(e) => setPanchayathState(e.target.value)}
                          placeholder="Kerala"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="panchayathDistrict">District</Label>
                        <Input
                          id="panchayathDistrict"
                          value={panchayathDistrict}
                          onChange={(e) => setPanchayathDistrict(e.target.value)}
                          placeholder="District name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="panchayathWard">Ward</Label>
                      <Input
                        id="panchayathWard"
                        value={panchayathWard}
                        onChange={(e) => setPanchayathWard(e.target.value)}
                        placeholder="Ward number or name"
                      />
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
                            Creating...
                          </>
                        ) : (
                          "Create Panchayath"
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
                    <TableHead>State</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Ward</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panchayaths.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No panchayaths found. Add your first panchayath to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    panchayaths.map((panchayath) => (
                      <TableRow key={panchayath.id}>
                        <TableCell className="font-medium">{panchayath.name}</TableCell>
                        <TableCell>{panchayath.name_ml || "-"}</TableCell>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => togglePanchayathStatus(panchayath.id, panchayath.is_active ?? true)}
                          >
                            {panchayath.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                      <Select
                        value={selectedPanchayath}
                        onValueChange={setSelectedPanchayath}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a panchayath" />
                        </SelectTrigger>
                        <SelectContent>
                          {panchayaths
                            .filter((p) => p.is_active)
                            .map((panchayath) => (
                              <SelectItem key={panchayath.id} value={panchayath.id}>
                                {panchayath.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
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
