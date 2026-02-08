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
import { Download, Users, Eye, Loader2, Star, CheckCircle2, Clock, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";
import { RegistrationVerification } from "./RegistrationVerification";
import { exportRegistrationsToXlsx } from "@/lib/exportXlsx";
import { format } from "date-fns";

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
      }
      return true;
    });

    // Sort by percentage descending for ranking (verified first)
    if (verificationEnabled) {
      filtered.sort((a, b) => {
        const aVerified = (a as any).verification_status === "verified";
        const bVerified = (b as any).verification_status === "verified";
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;
        if (aVerified && bVerified) {
          return ((b as any).percentage || 0) - ((a as any).percentage || 0);
        }
        return 0;
      });
    }

    return filtered;
  }, [registrations, panchayathFilter, statusFilter, minPercent, maxPercent, verificationEnabled]);

  // Calculate ranks for verified registrations
  const rankedRegistrations = useMemo(() => {
    if (!verificationEnabled) return new Map<string, number>();
    
    const verifiedSorted = [...registrations]
      .filter((r) => (r as any).verification_status === "verified")
      .sort((a, b) => ((b as any).percentage || 0) - ((a as any).percentage || 0));
    
    const rankMap = new Map<string, number>();
    verifiedSorted.forEach((r, idx) => {
      rankMap.set(r.id, idx + 1);
    });
    return rankMap;
  }, [registrations, verificationEnabled]);

  const handleExport = () => {
    setIsExporting(true);
    try {
      exportRegistrationsToXlsx(filteredRegistrations, questions, programName);
    } finally {
      setIsExporting(false);
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
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="Min %"
                      value={minPercent}
                      onChange={(e) => setMinPercent(e.target.value)}
                      className="w-16 h-8 text-xs"
                      min={0}
                      max={100}
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max %"
                      value={maxPercent}
                      onChange={(e) => setMaxPercent(e.target.value)}
                      className="w-16 h-8 text-xs"
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
                    const rank = rankedRegistrations.get(registration.id);

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
                              {rank ? (
                                <Badge 
                                  variant="outline" 
                                  className={rank <= 3 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold" : ""}
                                >
                                  #{rank}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
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
