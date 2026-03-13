import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Download, Users, Eye, Loader2, Star, CheckCircle2, Clock, Filter, X, Trophy, Save, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";
import { RegistrationVerification } from "./RegistrationVerification";
import { exportRegistrationsToXlsx, exportRegistrationsToPdf } from "@/lib/exportXlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface RegistrationsTableProps {
  programName: string;
  questions: ProgramFormQuestion[];
  registrations: ProgramRegistration[];
  isLoading: boolean;
  verificationEnabled?: boolean;
  onRefresh?: () => void;
}

export function RegistrationsTable({
  programName,
  questions,
  registrations,
  isLoading,
  verificationEnabled = false,
  onRefresh,
}: RegistrationsTableProps) {
  const [selectedRegistration, setSelectedRegistration] = useState<ProgramRegistration | null>(
    null
  );
  const [verifyingRegistration, setVerifyingRegistration] = useState<ProgramRegistration | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const [panchayathFilter, setPanchayathFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minPercent, setMinPercent] = useState<string>("");
  const [maxPercent, setMaxPercent] = useState<string>("");
  const [minRank, setMinRank] = useState<string>("");
  const [maxRank, setMaxRank] = useState<string>("");
  const [editingRanks, setEditingRanks] = useState<Record<string, string>>({});
  const [savingRank, setSavingRank] = useState<string | null>(null);
  const { adminToken } = useAuth();
  const { toast } = useToast();

  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  // Extract unique panchayaths from registrations
  const panchayaths = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => {
      const answers = r.answers as Record<string, any>;
      const name = answers._fixed?.panchayath_name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [registrations]);

  // Filter and rank registrations
  const filteredRegistrations = useMemo(() => {
    // First filter
    const filtered = registrations.filter((r) => {
      const answers = r.answers as Record<string, any>;
      const pName = answers._fixed?.panchayath_name || "";
      if (panchayathFilter !== "all" && pName !== panchayathFilter) return false;

      if (verificationEnabled) {
        const status = (r as any).verification_status;
        if (statusFilter !== "all") {
          if (statusFilter === "pending" && status === "verified") return false;
          if (statusFilter === "verified" && status !== "verified") return false;
        }

        // Percentage range filter (manual inputs)
        const hasMinFilter = minPercent !== "" && !isNaN(Number(minPercent));
        const hasMaxFilter = maxPercent !== "" && !isNaN(Number(maxPercent));
        
        if ((hasMinFilter || hasMaxFilter) && status === "verified") {
          const pct = (r as any).percentage || 0;
          if (hasMinFilter && pct < Number(minPercent)) return false;
          if (hasMaxFilter && pct > Number(maxPercent)) return false;
        } else if ((hasMinFilter || hasMaxFilter) && status !== "verified") {
          return false; // Hide unverified when filtering by percentage
        }

        // Rank filter (manual inputs)
        const hasMinRankFilter = minRank !== "" && !isNaN(Number(minRank));
        const hasMaxRankFilter = maxRank !== "" && !isNaN(Number(maxRank));
        
        if (hasMinRankFilter || hasMaxRankFilter) {
          const rk = (r as any).rank;
          if (rk === null || rk === undefined) return false; // No rank assigned
          if (hasMinRankFilter && rk < Number(minRank)) return false;
          if (hasMaxRankFilter && rk > Number(maxRank)) return false;
        }
      }
      return true;
    });

    // Sort by rank (if set), then by percentage descending for verified
    if (verificationEnabled) {
      filtered.sort((a, b) => {
        const aVerified = (a as any).verification_status === "verified";
        const bVerified = (b as any).verification_status === "verified";
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;
        if (aVerified && bVerified) {
          // Sort by manual rank first (if both have rank)
          const aRank = (a as any).rank;
          const bRank = (b as any).rank;
          if (aRank != null && bRank != null) {
            return aRank - bRank;
          }
          if (aRank != null) return -1;
          if (bRank != null) return 1;
          // Otherwise by percentage
          return ((b as any).percentage || 0) - ((a as any).percentage || 0);
        }
        return 0;
      });
    }

    return filtered;
  }, [registrations, panchayathFilter, statusFilter, minPercent, maxPercent, minRank, maxRank, verificationEnabled]);

  // Save rank for a registration
  const handleSaveRank = async (registrationId: string) => {
    if (!adminToken) {
      toast({ title: "Error", description: "You must be logged in as admin", variant: "destructive" });
      return;
    }

    setSavingRank(registrationId);
    try {
      const rankValue = editingRanks[registrationId];
      const response = await supabase.functions.invoke("admin-registrations", {
        method: "PUT",
        headers: { "x-admin-token": adminToken },
        body: {
          registration_id: registrationId,
          rank: rankValue === "" ? null : parseInt(rankValue),
        },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.error?.message || response.data?.error || "Failed to save rank");
      }

      toast({ title: "Rank saved", description: `Rank updated to ${rankValue || "none"}` });
      setEditingRanks((prev) => {
        const next = { ...prev };
        delete next[registrationId];
        return next;
      });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingRank(null);
    }
  };

  const getRankValue = (registration: ProgramRegistration) => {
    const id = registration.id;
    if (editingRanks[id] !== undefined) return editingRanks[id];
    const dbRank = (registration as any).rank;
    return dbRank != null ? String(dbRank) : "";
  };

  const handleRankChange = (registrationId: string, value: string) => {
    setEditingRanks((prev) => ({ ...prev, [registrationId]: value }));
  };

  const isRankEdited = (registrationId: string, dbRank: number | null) => {
    if (editingRanks[registrationId] === undefined) return false;
    const currentValue = editingRanks[registrationId];
    const dbValue = dbRank != null ? String(dbRank) : "";
    return currentValue !== dbValue;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportRegistrationsToXlsx(filteredRegistrations, questions, programName);
    } catch (err: any) {
      console.error("XLSX export error:", err);
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => {
    try {
      exportRegistrationsToPdf(filteredRegistrations, questions, programName);
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  const getAnswerDisplay = (registration: ProgramRegistration, questionId: string) => {
    const answers = registration.answers as Record<string, any>;
    const answer = answers[questionId];

    if (answer === undefined || answer === null || answer === "") return "-";
    if (Array.isArray(answer)) return answer.join(", ");
    return String(answer);
  };

  const getFixedFieldDisplay = (registration: ProgramRegistration, field: string) => {
    const answers = registration.answers as Record<string, any>;
    const fixedData = answers._fixed;
    if (!fixedData) return "-";
    const value = fixedData[field];
    if (value === undefined || value === null || value === "") return "-";
    return String(value);
  };

  const getVerificationStatus = (registration: ProgramRegistration) => {
    const status = (registration as any).verification_status;
    const percentage = (registration as any).percentage;
    
    if (status === "verified") {
      return {
        label: `${percentage?.toFixed(1) || 0}%`,
        variant: "default" as const,
        icon: CheckCircle2,
        color: percentage >= 70 ? "bg-emerald-600" : percentage >= 40 ? "bg-amber-600" : "bg-destructive",
      };
    }
    return {
      label: "Pending",
      variant: "secondary" as const,
      icon: Clock,
      color: "",
    };
  };

  const handleVerificationComplete = () => {
    setVerifyingRegistration(null);
    onRefresh?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-5 w-5" />
                Registrations
                <Badge variant="secondary">{registrations.length}</Badge>
                {verificationEnabled && (
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    <Star className="h-3 w-3 mr-1" />
                    Verification On
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {verificationEnabled 
                  ? "View, verify, and export program registrations"
                  : "View and export program registrations"
                }
              </CardDescription>
            </div>
            <Button 
              onClick={handleExport} 
              disabled={filteredRegistrations.length === 0 || isExporting}
              size="sm"
              className="w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export XLSX
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          {registrations.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={panchayathFilter} onValueChange={setPanchayathFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Panchayath" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Panchayaths</SelectItem>
                  {panchayaths.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {verificationEnabled && (
                <>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1" title="Score % range">
                    <span className="text-xs text-muted-foreground">%:</span>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPercent}
                      onChange={(e) => setMinPercent(e.target.value)}
                      className="w-14 h-8 text-xs"
                      min={0}
                      max={100}
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPercent}
                      onChange={(e) => setMaxPercent(e.target.value)}
                      className="w-14 h-8 text-xs"
                      min={0}
                      max={100}
                    />
                    {(minPercent || maxPercent) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setMinPercent(""); setMaxPercent(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1" title="Rank range">
                    <Trophy className="h-3 w-3 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minRank}
                      onChange={(e) => setMinRank(e.target.value)}
                      className="w-14 h-8 text-xs"
                      min={1}
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxRank}
                      onChange={(e) => setMaxRank(e.target.value)}
                      className="w-14 h-8 text-xs"
                      min={1}
                    />
                    {(minRank || maxRank) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setMinRank(""); setMaxRank(""); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredRegistrations.length} of {registrations.length}
              </span>
            </div>
          )}

          {filteredRegistrations.length === 0 && registrations.length > 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No registrations match the selected filters.</p>
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No registrations yet.</p>
              <p className="text-sm">Registrations will appear here once people register.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Mobile</TableHead>
                    <TableHead className="hidden lg:table-cell">Panchayath</TableHead>
                    {verificationEnabled && (
                      <>
                        <TableHead className="text-center w-16">Rank</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((registration, index) => {
                    const verification = verificationEnabled ? getVerificationStatus(registration) : null;
                    const StatusIcon = verification?.icon;
                    const dbRank = (registration as any).rank;
                    const rankValue = getRankValue(registration);
                    const isEdited = isRankEdited(registration.id, dbRank);

                    return (
                      <TableRow key={registration.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {format(new Date(registration.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getFixedFieldDisplay(registration, "name")}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {getFixedFieldDisplay(registration, "mobile")}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {getFixedFieldDisplay(registration, "panchayath_name")}
                        </TableCell>
                        {verificationEnabled && verification && StatusIcon && (
                          <>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  value={rankValue}
                                  onChange={(e) => handleRankChange(registration.id, e.target.value)}
                                  placeholder="-"
                                  className={`w-14 h-7 text-xs text-center ${
                                    rankValue && parseInt(rankValue) <= 3 
                                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" 
                                      : ""
                                  }`}
                                  min={1}
                                />
                                {isEdited && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleSaveRank(registration.id)}
                                    disabled={savingRank === registration.id}
                                  >
                                    {savingRank === registration.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={verification.variant}
                                className={verification.color}
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {verification.label}
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedRegistration(registration)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {verificationEnabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setVerifyingRegistration(registration)}
                                title={(registration as any).verification_status === "verified" ? "View verification" : "Verify registration"}
                                className={(registration as any).verification_status === "verified" ? "text-emerald-600" : "text-amber-600"}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog
        open={!!selectedRegistration}
        onOpenChange={(open) => !open && setSelectedRegistration(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>
              Submitted on{" "}
              {selectedRegistration &&
                format(new Date(selectedRegistration.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-4">
              {/* Fixed Fields */}
              <div className="space-y-3 pb-4 border-b">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Name <span className="text-destructive">*</span>
                  </p>
                  <p className="text-foreground">
                    {getFixedFieldDisplay(selectedRegistration, "name")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Mobile Number <span className="text-destructive">*</span>
                  </p>
                  <p className="text-foreground">
                    {getFixedFieldDisplay(selectedRegistration, "mobile")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Panchayath <span className="text-destructive">*</span>
                  </p>
                  <p className="text-foreground">
                    {getFixedFieldDisplay(selectedRegistration, "panchayath_name")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ward <span className="text-destructive">*</span>
                  </p>
                  <p className="text-foreground">
                    Ward {getFixedFieldDisplay(selectedRegistration, "ward")}
                  </p>
                </div>
              </div>

              {/* Custom Questions */}
              {sortedQuestions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Additional Information</p>
                  {sortedQuestions.map((question) => (
                    <div key={question.id} className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {question.question_text}
                        {question.is_required && <span className="text-destructive ml-1">*</span>}
                      </p>
                      <p className="text-foreground">
                        {getAnswerDisplay(selectedRegistration, question.id)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Verification Status (if enabled and verified) */}
              {verificationEnabled && (selectedRegistration as any).verification_status === "verified" && (
                <div className="pt-4 border-t">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Verified</span>
                      <Badge variant="secondary" className="ml-auto">
                        {(selectedRegistration as any).percentage?.toFixed(1) || 0}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Score: {(selectedRegistration as any).total_score || 0} / {(selectedRegistration as any).max_score || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <RegistrationVerification
        registration={verifyingRegistration}
        questions={sortedQuestions}
        open={!!verifyingRegistration}
        onOpenChange={(open) => !open && setVerifyingRegistration(null)}
        onVerificationComplete={handleVerificationComplete}
      />
    </>
  );
}
