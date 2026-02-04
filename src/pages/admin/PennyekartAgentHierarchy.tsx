import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Building2,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  usePennyekartAgents, 
  useAgentMutations,
  AgentFilters,
  AgentRole,
  ROLE_LABELS,
  ROLE_HIERARCHY,
  PennyekartAgent,
  getChildRole
} from "@/hooks/usePennyekartAgents";
import { AgentHierarchyTree } from "@/components/pennyekart/AgentHierarchyTree";
import { BulkAgentFormDialog } from "@/components/pennyekart/BulkAgentFormDialog";
import { AgentDetailsPanel } from "@/components/pennyekart/AgentDetailsPanel";
import { toast } from "sonner";

interface Panchayath {
  id: string;
  name: string;
}

export default function PennyekartAgentHierarchy() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [filters, setFilters] = useState<AgentFilters>({});
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<PennyekartAgent | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<PennyekartAgent | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [defaultRole, setDefaultRole] = useState<AgentRole | null>(null);

  const { agents, isLoading, error, refetch } = usePennyekartAgents(filters);
  const { deleteAgent } = useAgentMutations();

  // Check permissions
  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Load panchayaths
  useEffect(() => {
    const fetchPanchayaths = async () => {
      const { data } = await supabase
        .from("panchayaths")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPanchayaths(data || []);
    };
    fetchPanchayaths();
  }, []);

  // Load unique wards when panchayath is selected
  useEffect(() => {
    const fetchWards = async () => {
      if (!filters.panchayath_id) {
        setWards([]);
        return;
      }

      const { data } = await supabase
        .from("pennyekart_agents")
        .select("ward")
        .eq("panchayath_id", filters.panchayath_id);

      const uniqueWards = [...new Set((data || []).map(a => a.ward))].sort();
      setWards(uniqueWards);
    };
    fetchWards();
  }, [filters.panchayath_id]);

  const handleAddAgent = () => {
    setEditingAgent(null);
    setDefaultParentId(null);
    setDefaultRole(null);
    setFormDialogOpen(true);
  };

  const handleEditAgent = (agent: PennyekartAgent) => {
    setEditingAgent(agent);
    setDefaultParentId(null);
    setDefaultRole(null);
    setFormDialogOpen(true);
  };

  const handleAddChildAgent = (parent: PennyekartAgent) => {
    const childRole = getChildRole(parent.role);
    if (!childRole) return;

    setEditingAgent(null);
    setDefaultParentId(parent.id);
    setDefaultRole(childRole);
    setFormDialogOpen(true);
  };

  const handleDeleteAgent = async (agent: PennyekartAgent) => {
    const { error } = await deleteAgent(agent.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Agent deleted");
    setSelectedAgent(null);
    refetch();
  };

  const handleFilterChange = (key: keyof AgentFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Calculate stats
  const totalAgents = agents.length;
  const byRole = ROLE_HIERARCHY.reduce((acc, role) => {
    acc[role] = agents.filter(a => a.role === role).length;
    return acc;
  }, {} as Record<AgentRole, number>);
  const totalCustomers = agents
    .filter(a => a.role === "pro")
    .reduce((sum, a) => sum + a.customer_count, 0);

  return (
    <Layout>
      <div className="container py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link to="/admin-dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Pennyekart Agent Hierarchy</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-11">
              Manage agent network and customer assignments
            </p>
          </div>
          <Button onClick={handleAddAgent}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card className="p-3">
            <div className="text-2xl font-bold">{totalAgents}</div>
            <div className="text-xs text-muted-foreground">Total Agents</div>
          </Card>
          {ROLE_HIERARCHY.map(role => (
            <Card key={role} className="p-3">
              <div className="text-2xl font-bold">{byRole[role]}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[role]}s</div>
            </Card>
          ))}
          <Card className="p-3">
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <div className="text-xs text-muted-foreground">Total Customers</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or mobile..."
                  className="pl-9"
                  value={filters.search || ""}
                  onChange={(e) => handleFilterChange("search", e.target.value || undefined)}
                />
              </div>
              
              <Select
                value={filters.panchayath_id || "all"}
                onValueChange={(v) => handleFilterChange("panchayath_id", v)}
              >
                <SelectTrigger>
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Panchayaths" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Panchayaths</SelectItem>
                  {panchayaths.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.ward || "all"}
                onValueChange={(v) => handleFilterChange("ward", v)}
                disabled={!filters.panchayath_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Wards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wards</SelectItem>
                  {wards.map(w => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.role || "all"}
                onValueChange={(v) => handleFilterChange("role", v as AgentRole)}
              >
                <SelectTrigger>
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLE_HIERARCHY.map(role => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {Object.values(filters).some(v => v) && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Hierarchy Tree */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Agent Hierarchy
              </CardTitle>
              <CardDescription>
                Click on an agent to view details and manage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  <p>Error loading agents: {error}</p>
                  <Button variant="outline" className="mt-4" onClick={refetch}>
                    Retry
                  </Button>
                </div>
              ) : (
                <AgentHierarchyTree
                  agents={agents}
                  onSelectAgent={setSelectedAgent}
                  selectedAgentId={selectedAgent?.id}
                />
              )}
            </CardContent>
          </Card>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            {selectedAgent ? (
              <AgentDetailsPanel
                agent={selectedAgent}
                allAgents={agents}
                onEdit={() => handleEditAgent(selectedAgent)}
                onDelete={() => handleDeleteAgent(selectedAgent)}
                onAddChild={() => handleAddChildAgent(selectedAgent)}
                onClose={() => setSelectedAgent(null)}
              />
            ) : (
              <Card className="h-full min-h-[300px] flex items-center justify-center">
                <div className="text-center text-muted-foreground p-6">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an agent to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Form Dialog */}
        <BulkAgentFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          agent={editingAgent}
          defaultParentId={defaultParentId}
          defaultRole={defaultRole}
          onSuccess={refetch}
        />
      </div>
    </Layout>
  );
}
