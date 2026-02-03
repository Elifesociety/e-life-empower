import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock, User, Phone, Star, CheckCircle2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { RegistrationVerification } from "@/components/programs/RegistrationVerification";
import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";

interface Program {
  id: string;
  name: string;
  verification_enabled: boolean;
}

interface Registration {
  id: string;
  program_id: string;
  answers: Record<string, any>;
  created_at: string;
  verification_status: string;
  percentage: number | null;
  total_score: number | null;
  max_score: number | null;
  verification_scores: Record<string, number> | null;
  verified_at: string | null;
  verified_by: string | null;
}

interface RegistrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterPanchayathId?: string;
  filterPanchayathName?: string;
}

export function RegistrationsDialog({
  open,
  onOpenChange,
  filterPanchayathId,
  filterPanchayathName,
}: RegistrationsDialogProps) {
  const { adminData, adminToken } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [formQuestions, setFormQuestions] = useState<ProgramFormQuestion[]>([]);
  const [verifyingRegistration, setVerifyingRegistration] = useState<ProgramRegistration | null>(null);
  const [selectedRegDetails, setSelectedRegDetails] = useState<Registration | null>(null);

  // Get the selected program's verification status
  const selectedProgram = programs.find((p) => p.id === selectedProgramId);
  const verificationEnabled = selectedProgram?.verification_enabled ?? false;

  // Fetch programs for the admin's division
  useEffect(() => {
    const fetchPrograms = async () => {
      if (!open || !adminData?.division_id) return;

      setProgramsLoading(true);
      const { data } = await supabase
        .from("programs")
        .select("id, name, verification_enabled")
        .eq("division_id", adminData.division_id)
        .eq("is_active", true)
        .order("name");

      setPrograms(data || []);
      setProgramsLoading(false);
    };

    fetchPrograms();
  }, [open, adminData?.division_id]);

  // Fetch form questions when a specific program is selected
  useEffect(() => {
    const fetchQuestions = async () => {
      if (selectedProgramId === "all" || !selectedProgramId) {
        setFormQuestions([]);
        return;
      }

      const { data } = await supabase
        .from("program_form_questions")
        .select("*")
        .eq("program_id", selectedProgramId)
        .order("sort_order");

      setFormQuestions(data || []);
    };

    if (open) {
      fetchQuestions();
    }
  }, [open, selectedProgramId]);

  // Fetch registrations when program or filter changes
  const fetchRegistrations = useCallback(async () => {
    if (!open || !adminToken) return;

    setIsLoading(true);
    try {
      let allRegistrations: Registration[] = [];
      const programsToFetch = selectedProgramId === "all" 
        ? programs.map(p => p.id)
        : [selectedProgramId];

      // Fetch registrations for each program using the edge function
      for (const programId of programsToFetch) {
        const response = await fetch(
          `https://qnucqwniloioxsowdqzj.supabase.co/functions/v1/admin-registrations?program_id=${programId}`,
          {
            headers: {
              "Content-Type": "application/json",
              "x-admin-token": adminToken,
            },
          }
        );

        if (response.ok) {
          const { registrations: regs } = await response.json();
          allRegistrations = [...allRegistrations, ...regs];
        }
      }

      // Filter by panchayath if specified
      if (filterPanchayathId) {
        allRegistrations = allRegistrations.filter(
          (reg) => reg.answers?._fixed?.panchayath_id === filterPanchayathId
        );
      }

      // Sort by created_at descending
      allRegistrations.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRegistrations(allRegistrations);
    } catch (error) {
      console.error("Error fetching registrations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [open, adminToken, selectedProgramId, programs, filterPanchayathId]);

  useEffect(() => {
    if (open && programs.length > 0) {
      fetchRegistrations();
    }
  }, [open, programs, selectedProgramId, fetchRegistrations]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProgramId("all");
      setRegistrations([]);
      setFormQuestions([]);
      setVerifyingRegistration(null);
    }
  }, [open]);

  const getProgramName = (programId: string) => {
    return programs.find((p) => p.id === programId)?.name || "Unknown Program";
  };

  const getVerificationBadge = (reg: Registration) => {
    const program = programs.find((p) => p.id === reg.program_id);
    if (!program?.verification_enabled) return null;

    if (reg.verification_status === "verified") {
      const percentage = reg.percentage ?? 0;
      return (
        <Badge
          className={
            percentage >= 70
              ? "bg-emerald-600"
              : percentage >= 40
              ? "bg-amber-600"
              : "bg-destructive"
          }
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {percentage.toFixed(1)}%
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const handleVerify = (reg: Registration) => {
    // Cast to ProgramRegistration for compatibility with verification component
    setVerifyingRegistration(reg as unknown as ProgramRegistration);
  };

  const handleVerificationComplete = () => {
    setVerifyingRegistration(null);
    fetchRegistrations();
  };

  // Check if any program in selection has verification enabled
  const anyVerificationEnabled = selectedProgramId === "all"
    ? programs.some((p) => p.verification_enabled)
    : verificationEnabled;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Registrations
              {filterPanchayathName && (
                <Badge variant="secondary" className="ml-2">
                  <MapPin className="h-3 w-3 mr-1" />
                  {filterPanchayathName}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {filterPanchayathName
                ? `Viewing registrations from ${filterPanchayathName}`
                : "View all registrations across programs"}
            </DialogDescription>
          </DialogHeader>

          {/* Program Filter */}
          <div className="flex items-center gap-2 py-2">
            <span className="text-sm text-muted-foreground">Program:</span>
            <Select
              value={selectedProgramId}
              onValueChange={setSelectedProgramId}
              disabled={programsLoading}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    <span className="flex items-center gap-2">
                      {program.name}
                      {program.verification_enabled && (
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && (
              <Badge variant="outline" className="ml-2">
                {registrations.length} registrations
              </Badge>
            )}
          </div>

          {/* Registrations Table */}
          <div className="flex-1 overflow-auto border rounded-md">
            {isLoading || programsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No registrations found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Panchayath</TableHead>
                    <TableHead>Ward</TableHead>
                    <TableHead>Program</TableHead>
                    {anyVerificationEnabled && (
                      <TableHead className="text-center">Status</TableHead>
                    )}
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => {
                    const program = programs.find((p) => p.id === reg.program_id);
                    return (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {reg.answers?._fixed?.name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {reg.answers?._fixed?.mobile || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {reg.answers?._fixed?.panchayath_name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>{reg.answers?._fixed?.ward || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {getProgramName(reg.program_id)}
                          </Badge>
                        </TableCell>
                        {anyVerificationEnabled && (
                          <TableCell className="text-center">
                            {getVerificationBadge(reg)}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(reg.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedRegDetails(reg)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {program?.verification_enabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleVerify(reg)}
                                title={
                                  reg.verification_status === "verified"
                                    ? "View verification"
                                    : "Verify registration"
                                }
                                className={
                                  reg.verification_status === "verified"
                                    ? "text-emerald-600"
                                    : "text-amber-600"
                                }
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Registration Details Dialog */}
      <Dialog
        open={!!selectedRegDetails}
        onOpenChange={(open) => !open && setSelectedRegDetails(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>
              {selectedRegDetails && getProgramName(selectedRegDetails.program_id)}
            </DialogDescription>
          </DialogHeader>

          {selectedRegDetails && (
            <div className="space-y-4">
              <div className="space-y-3 pb-4 border-b">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p>{selectedRegDetails.answers?._fixed?.name || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Mobile</p>
                  <p>{selectedRegDetails.answers?._fixed?.mobile || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Panchayath</p>
                  <p>{selectedRegDetails.answers?._fixed?.panchayath_name || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Ward</p>
                  <p>Ward {selectedRegDetails.answers?._fixed?.ward || "N/A"}</p>
                </div>
              </div>

              {/* Verification Status */}
              {programs.find((p) => p.id === selectedRegDetails.program_id)?.verification_enabled &&
                selectedRegDetails.verification_status === "verified" && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Verified</span>
                      <Badge variant="secondary" className="ml-auto">
                        {selectedRegDetails.percentage?.toFixed(1) || 0}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Score: {selectedRegDetails.total_score || 0} / {selectedRegDetails.max_score || 0}
                    </p>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <RegistrationVerification
        registration={verifyingRegistration}
        questions={formQuestions}
        open={!!verifyingRegistration}
        onOpenChange={(open) => !open && setVerifyingRegistration(null)}
        onVerificationComplete={handleVerificationComplete}
      />
    </>
  );
}
