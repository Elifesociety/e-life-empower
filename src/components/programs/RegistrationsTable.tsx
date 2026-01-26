import { useState } from "react";
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
import { Download, Users, Eye, Loader2 } from "lucide-react";
import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";
import { exportRegistrationsToXlsx } from "@/lib/exportXlsx";
import { format } from "date-fns";

interface RegistrationsTableProps {
  programName: string;
  questions: ProgramFormQuestion[];
  registrations: ProgramRegistration[];
  isLoading: boolean;
}

export function RegistrationsTable({
  programName,
  questions,
  registrations,
  isLoading,
}: RegistrationsTableProps) {
  const [selectedRegistration, setSelectedRegistration] = useState<ProgramRegistration | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);

  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  const handleExport = () => {
    setIsExporting(true);
    try {
      exportRegistrationsToXlsx(registrations, questions, programName);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Registrations
                <Badge variant="secondary">{registrations.length}</Badge>
              </CardTitle>
              <CardDescription>View and export program registrations</CardDescription>
            </div>
            <Button onClick={handleExport} disabled={registrations.length === 0 || isExporting}>
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
          {registrations.length === 0 ? (
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
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Panchayath</TableHead>
                    <TableHead>Ward</TableHead>
                    {sortedQuestions.length > 0 && (
                      <TableHead>+{sortedQuestions.length} more</TableHead>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration, index) => (
                    <TableRow key={registration.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {format(new Date(registration.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getFixedFieldDisplay(registration, "name")}
                      </TableCell>
                      <TableCell>
                        {getFixedFieldDisplay(registration, "mobile")}
                      </TableCell>
                      <TableCell>
                        {getFixedFieldDisplay(registration, "panchayath_name")}
                      </TableCell>
                      <TableCell>
                        {getFixedFieldDisplay(registration, "ward")}
                      </TableCell>
                      {sortedQuestions.length > 0 && <TableCell>...</TableCell>}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedRegistration(registration)}
                        >
                          <Eye className="h-4 w-4" />
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
