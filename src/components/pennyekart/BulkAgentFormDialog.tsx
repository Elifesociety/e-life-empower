import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  PennyekartAgent, 
  AgentRole, 
  ROLE_LABELS, 
  ROLE_HIERARCHY,
  getParentRole,
  useAgentMutations 
} from "@/hooks/usePennyekartAgents";
import { toast } from "sonner";

const singleAgentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits"),
  role: z.enum(["team_leader", "coordinator", "group_leader", "pro"] as const),
  panchayath_id: z.string().uuid("Select a panchayath"),
  ward: z.string().min(1, "Ward is required"),
  parent_agent_id: z.string().uuid().nullable().optional(),
  customer_count: z.number().int().min(0).default(0),
});

const bulkAgentSchema = z.object({
  panchayath_id: z.string().uuid("Select a panchayath"),
  role: z.enum(["team_leader", "coordinator", "group_leader", "pro"] as const),
  parent_agent_id: z.string().uuid().nullable().optional(),
  agents: z.array(z.object({
    name: z.string().min(2, "Name required"),
    mobile: z.string().regex(/^[0-9]{10}$/, "10 digits required"),
    ward: z.string().min(1, "Ward required"),
    customer_count: z.number().int().min(0).default(0),
  })).min(1, "Add at least one agent"),
});

type SingleAgentFormValues = z.infer<typeof singleAgentSchema>;
type BulkAgentFormValues = z.infer<typeof bulkAgentSchema>;

interface BulkAgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: PennyekartAgent | null;
  defaultParentId?: string | null;
  defaultRole?: AgentRole | null;
  onSuccess: () => void;
}

interface Panchayath {
  id: string;
  name: string;
  ward: string | null;
}

export function BulkAgentFormDialog({ 
  open, 
  onOpenChange, 
  agent, 
  defaultParentId,
  defaultRole,
  onSuccess 
}: BulkAgentFormDialogProps) {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [potentialParents, setPotentialParents] = useState<PennyekartAgent[]>([]);
  const [isLoadingPanchayaths, setIsLoadingPanchayaths] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!agent;

  // Single agent form
  const singleForm = useForm<SingleAgentFormValues>({
    resolver: zodResolver(singleAgentSchema),
    defaultValues: {
      name: "",
      mobile: "",
      role: defaultRole || "pro",
      panchayath_id: "",
      ward: "",
      parent_agent_id: defaultParentId || null,
      customer_count: 0,
    },
  });

  // Bulk agent form
  const bulkForm = useForm<BulkAgentFormValues>({
    resolver: zodResolver(bulkAgentSchema),
    defaultValues: {
      panchayath_id: "",
      role: defaultRole || "pro",
      parent_agent_id: defaultParentId || null,
      agents: [{ name: "", mobile: "", ward: "", customer_count: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: bulkForm.control,
    name: "agents",
  });

  const selectedSingleRole = singleForm.watch("role");
  const selectedSinglePanchayath = singleForm.watch("panchayath_id");
  const selectedBulkRole = bulkForm.watch("role");
  const selectedBulkPanchayath = bulkForm.watch("panchayath_id");

  // Load panchayaths
  useEffect(() => {
    const fetchPanchayaths = async () => {
      setIsLoadingPanchayaths(true);
      const { data } = await supabase
        .from("panchayaths")
        .select("id, name, ward")
        .eq("is_active", true)
        .order("name");
      
      setPanchayaths(data || []);
      setIsLoadingPanchayaths(false);
    };

    if (open) {
      fetchPanchayaths();
    }
  }, [open]);

  // Update ward options when panchayath changes (for single form)
  useEffect(() => {
    if (selectedSinglePanchayath) {
      const panchayath = panchayaths.find(p => p.id === selectedSinglePanchayath);
      if (panchayath?.ward) {
        const wardCount = parseInt(panchayath.ward, 10);
        if (!isNaN(wardCount) && wardCount > 0) {
          const wards = Array.from({ length: wardCount }, (_, i) => String(i + 1));
          setWardOptions(wards);
          return;
        }
      }
    }
    setWardOptions([]);
  }, [selectedSinglePanchayath, panchayaths]);

  // Update ward options when panchayath changes (for bulk form)
  useEffect(() => {
    if (selectedBulkPanchayath) {
      const panchayath = panchayaths.find(p => p.id === selectedBulkPanchayath);
      if (panchayath?.ward) {
        const wardCount = parseInt(panchayath.ward, 10);
        if (!isNaN(wardCount) && wardCount > 0) {
          const wards = Array.from({ length: wardCount }, (_, i) => String(i + 1));
          setWardOptions(wards);
          return;
        }
      }
    }
    setWardOptions([]);
  }, [selectedBulkPanchayath, panchayaths]);

  // Load potential parent agents (single form)
  useEffect(() => {
    const fetchParentAgents = async () => {
      const parentRole = getParentRole(selectedSingleRole);
      if (!parentRole || !selectedSinglePanchayath) {
        setPotentialParents([]);
        return;
      }

      const { data } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, ward")
        .eq("panchayath_id", selectedSinglePanchayath)
        .eq("role", parentRole)
        .eq("is_active", true)
        .order("name");

      setPotentialParents((data as unknown as PennyekartAgent[]) || []);
    };

    fetchParentAgents();
  }, [selectedSingleRole, selectedSinglePanchayath]);

  // Load potential parent agents (bulk form)
  useEffect(() => {
    const fetchParentAgents = async () => {
      const parentRole = getParentRole(selectedBulkRole);
      if (!parentRole || !selectedBulkPanchayath) {
        setPotentialParents([]);
        return;
      }

      const { data } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, ward")
        .eq("panchayath_id", selectedBulkPanchayath)
        .eq("role", parentRole)
        .eq("is_active", true)
        .order("name");

      setPotentialParents((data as unknown as PennyekartAgent[]) || []);
    };

    fetchParentAgents();
  }, [selectedBulkRole, selectedBulkPanchayath]);

  // Reset forms when dialog opens/closes
  useEffect(() => {
    if (open && agent) {
      setActiveTab("single");
      singleForm.reset({
        name: agent.name,
        mobile: agent.mobile,
        role: agent.role,
        panchayath_id: agent.panchayath_id,
        ward: agent.ward,
        parent_agent_id: agent.parent_agent_id,
        customer_count: agent.customer_count,
      });
    } else if (open) {
      singleForm.reset({
        name: "",
        mobile: "",
        role: defaultRole || "pro",
        panchayath_id: "",
        ward: "",
        parent_agent_id: defaultParentId || null,
        customer_count: 0,
      });
      bulkForm.reset({
        panchayath_id: "",
        role: defaultRole || "pro",
        parent_agent_id: defaultParentId || null,
        agents: [{ name: "", mobile: "", ward: "", customer_count: 0 }],
      });
    }
  }, [open, agent, defaultParentId, defaultRole, singleForm, bulkForm]);

  const onSubmitSingle = async (values: SingleAgentFormValues) => {
    setIsSubmitting(true);
    try {
      // Team leaders don't have parents
      if (values.role === "team_leader") {
        values.parent_agent_id = null;
      }

      // Only PROs can have customer count
      if (values.role !== "pro") {
        values.customer_count = 0;
      }

      if (isEditing && agent) {
        const { error } = await supabase
          .from("pennyekart_agents")
          .update(values)
          .eq("id", agent.id);

        if (error) throw error;
        toast.success("Agent updated successfully");
      } else {
        const agentData = {
          name: values.name,
          mobile: values.mobile,
          role: values.role,
          panchayath_id: values.panchayath_id,
          ward: values.ward,
          parent_agent_id: values.parent_agent_id || null,
          customer_count: values.customer_count,
          is_active: true,
        };
        
        const { error } = await supabase
          .from("pennyekart_agents")
          .insert(agentData);

        if (error) {
          if (error.message.includes("unique") || error.code === "23505") {
            toast.error("Mobile number already exists");
            return;
          }
          throw error;
        }
        toast.success("Agent created successfully");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitBulk = async (values: BulkAgentFormValues) => {
    setIsSubmitting(true);
    try {
      // Only PROs can have customer count
      const isPro = values.role === "pro";
      const isTeamLeader = values.role === "team_leader";

      const agentsToInsert = values.agents.map(agent => ({
        name: agent.name,
        mobile: agent.mobile,
        role: values.role,
        panchayath_id: values.panchayath_id,
        ward: agent.ward,
        parent_agent_id: isTeamLeader ? null : (values.parent_agent_id || null),
        customer_count: isPro ? agent.customer_count : 0,
        is_active: true,
      }));

      const { error } = await supabase
        .from("pennyekart_agents")
        .insert(agentsToInsert);

      if (error) {
        if (error.message.includes("unique") || error.code === "23505") {
          toast.error("One or more mobile numbers already exist");
          return;
        }
        throw error;
      }

      toast.success(`${values.agents.length} agents created successfully`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agents");
    } finally {
      setIsSubmitting(false);
    }
  };

  const singleParentRole = getParentRole(selectedSingleRole);
  const bulkParentRole = getParentRole(selectedBulkRole);
  const singleNeedsParent = selectedSingleRole !== "team_leader";
  const bulkNeedsParent = selectedBulkRole !== "team_leader";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Agent" : "Add Agents"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update agent details" : "Add single or multiple agents to the hierarchy"}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          // Single form only for editing
          <Form {...singleForm}>
            <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-4">
              {renderSingleFormFields(singleForm, panchayaths, wardOptions, potentialParents, isLoadingPanchayaths, singleNeedsParent, singleParentRole, selectedSinglePanchayath, selectedSingleRole)}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "bulk")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Single Agent
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Bulk Add
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <Form {...singleForm}>
                <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-4">
                  {renderSingleFormFields(singleForm, panchayaths, wardOptions, potentialParents, isLoadingPanchayaths, singleNeedsParent, singleParentRole, selectedSinglePanchayath, selectedSingleRole)}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="bulk" className="mt-4">
              <Form {...bulkForm}>
                <form onSubmit={bulkForm.handleSubmit(onSubmitBulk)} className="space-y-4">
                  {/* Common fields for bulk */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={bulkForm.control}
                      name="panchayath_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Panchayath</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingPanchayaths ? "Loading..." : "Select"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {panchayaths.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.ward} wards)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bulkForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role (for all)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ROLE_HIERARCHY.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {bulkNeedsParent && (
                    <FormField
                      control={bulkForm.control}
                      name="parent_agent_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Reports To ({bulkParentRole ? ROLE_LABELS[bulkParentRole] : ""}) - for all agents
                          </FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={
                                  !selectedBulkPanchayath 
                                    ? "Select panchayath first" 
                                    : potentialParents.length === 0 
                                      ? `No ${bulkParentRole ? ROLE_LABELS[bulkParentRole] : "parent"} available` 
                                      : "Select parent"
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {potentialParents.map((parent) => (
                                <SelectItem key={parent.id} value={parent.id}>
                                  {parent.name} (Ward {parent.ward})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Agent list */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Agents ({fields.length})</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ name: "", mobile: "", ward: "", customer_count: 0 })}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Row
                      </Button>
                    </div>

                    <ScrollArea className="max-h-[280px]">
                      <div className="space-y-3">
                        {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                            <div className="col-span-3">
                              <FormField
                                control={bulkForm.control}
                                name={`agents.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    {index === 0 && <FormLabel className="text-xs">Name</FormLabel>}
                                    <FormControl>
                                      <Input placeholder="Name" {...field} className="h-9" />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="col-span-3">
                              <FormField
                                control={bulkForm.control}
                                name={`agents.${index}.mobile`}
                                render={({ field }) => (
                                  <FormItem>
                                    {index === 0 && <FormLabel className="text-xs">Mobile</FormLabel>}
                                    <FormControl>
                                      <Input placeholder="Mobile" maxLength={10} {...field} className="h-9" />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="col-span-2">
                              <FormField
                                control={bulkForm.control}
                                name={`agents.${index}.ward`}
                                render={({ field }) => (
                                  <FormItem>
                                    {index === 0 && <FormLabel className="text-xs">Ward</FormLabel>}
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Ward" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {wardOptions.map((w) => (
                                          <SelectItem key={w} value={w}>{w}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                            {selectedBulkRole === "pro" && (
                              <div className="col-span-2">
                                <FormField
                                  control={bulkForm.control}
                                  name={`agents.${index}.customer_count`}
                                  render={({ field }) => (
                                    <FormItem>
                                      {index === 0 && <FormLabel className="text-xs">Customers</FormLabel>}
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min={0}
                                          className="h-9"
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                            <div className={selectedBulkRole === "pro" ? "col-span-2" : "col-span-4"}>
                              {index === 0 && <div className="h-5" />}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive"
                                onClick={() => fields.length > 1 && remove(index)}
                                disabled={fields.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create {fields.length} Agent{fields.length > 1 ? "s" : ""}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper function to render single form fields
function renderSingleFormFields(
  form: ReturnType<typeof useForm<SingleAgentFormValues>>,
  panchayaths: Panchayath[],
  wardOptions: string[],
  potentialParents: PennyekartAgent[],
  isLoadingPanchayaths: boolean,
  needsParent: boolean,
  parentRole: AgentRole | null,
  selectedPanchayath: string,
  selectedRole: AgentRole
) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Agent name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="mobile"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mobile Number</FormLabel>
            <FormControl>
              <Input placeholder="10-digit mobile" maxLength={10} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLE_HIERARCHY.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="panchayath_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Panchayath</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingPanchayaths ? "Loading..." : "Select"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {panchayaths.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.ward} wards)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="ward"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ward</FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={wardOptions.length === 0}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedPanchayath 
                      ? "Select panchayath first" 
                      : wardOptions.length === 0 
                        ? "No wards available" 
                        : "Select ward"
                  } />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {wardOptions.map((w) => (
                  <SelectItem key={w} value={w}>Ward {w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {needsParent && (
        <FormField
          control={form.control}
          name="parent_agent_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Reports To ({parentRole ? ROLE_LABELS[parentRole] : ""})
              </FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedPanchayath 
                        ? "Select panchayath first" 
                        : potentialParents.length === 0 
                          ? `No ${parentRole ? ROLE_LABELS[parentRole] : "parent"} available` 
                          : "Select parent"
                    } />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {potentialParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name} (Ward {parent.ward})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {selectedRole === "pro" && (
        <FormField
          control={form.control}
          name="customer_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Count</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
