import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Star, CheckCircle2, User } from "lucide-react";
import { format } from "date-fns";

interface RegistrationVerificationProps {
  registration: ProgramRegistration | null;
  questions: ProgramFormQuestion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerificationComplete: () => void;
}

// Fixed fields that should not be scored (personal details)
const FIXED_FIELDS = ["name", "mobile", "panchayath", "panchayath_name", "ward", "cluster", "cluster_name"];

export function RegistrationVerification({
  registration,
  questions,
  open,
  onOpenChange,
  onVerificationComplete,
}: RegistrationVerificationProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { adminToken } = useAuth();

  // Filter questions that should be scored (exclude personal details)
  const scorableQuestions = questions.filter(
    (q) => !FIXED_FIELDS.some((field) => 
      q.question_text.toLowerCase().includes(field.toLowerCase())
    )
  ).sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (registration && open) {
      // Initialize scores from existing verification or empty
      const existingScores = (registration as any).verification_scores as Record<string, number> | null;
      if (existingScores) {
        setScores(existingScores);
      } else {
        // Initialize all scorable questions with 0
        const initialScores: Record<string, number> = {};
        scorableQuestions.forEach((q) => {
          initialScores[q.id] = 0;
        });
        setScores(initialScores);
      }
    }
  }, [registration, open, scorableQuestions.length]);

  const getAnswerDisplay = (questionId: string) => {
    if (!registration) return "-";
    const answers = registration.answers as Record<string, any>;
    const answer = answers[questionId];
    if (answer === undefined || answer === null || answer === "") return "-";
    if (Array.isArray(answer)) return answer.join(", ");
    return String(answer);
  };

  const getFixedFieldDisplay = (field: string) => {
    if (!registration) return "-";
    const answers = registration.answers as Record<string, any>;
    const fixedData = answers._fixed;
    if (!fixedData) return "-";
    const value = fixedData[field];
    if (value === undefined || value === null || value === "") return "-";
    return String(value);
  };

  const handleScoreChange = (questionId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    // Clamp between 0 and 10
    const clampedValue = Math.min(10, Math.max(0, numValue));
    setScores((prev) => ({ ...prev, [questionId]: clampedValue }));
  };

  const calculateTotals = () => {
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const maxScore = scorableQuestions.length * 10;
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    return { totalScore, maxScore, percentage };
  };

  const handleSubmitVerification = async () => {
    if (!registration) return;
    
    if (!adminToken) {
      toast({
        title: "Error",
        description: "You must be logged in as admin to verify registrations",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { totalScore, maxScore, percentage } = calculateTotals();

      const response = await supabase.functions.invoke("admin-registrations", {
        method: "PUT",
        headers: {
          "x-admin-token": adminToken,
        },
        body: {
          registration_id: registration.id,
          verification_scores: scores,
          total_score: totalScore,
          max_score: maxScore,
          percentage: percentage,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to save verification");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "Verification completed",
        description: `Total score: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`,
      });

      onOpenChange(false);
      onVerificationComplete();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save verification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { totalScore, maxScore, percentage } = calculateTotals();
  const isVerified = (registration as any)?.verification_status === "verified";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {isVerified ? "View Verification" : "Verify Registration"}
          </DialogTitle>
          <DialogDescription>
            {isVerified
              ? "This registration has already been verified"
              : "Score each response out of 10 points (excluding personal details)"}
          </DialogDescription>
        </DialogHeader>

        {registration && (
          <div className="space-y-6">
            {/* Personal Details (Read-only, not scored) */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Personal Details (Not Scored)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{getFixedFieldDisplay("name")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mobile:</span>{" "}
                  <span className="font-medium">{getFixedFieldDisplay("mobile")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Panchayath:</span>{" "}
                  <span className="font-medium">{getFixedFieldDisplay("panchayath_name")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ward:</span>{" "}
                  <span className="font-medium">{getFixedFieldDisplay("ward")}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Scorable Questions */}
            {scorableQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No questions available for scoring.</p>
                <p className="text-sm">Add custom questions to the form to enable verification.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Questions to Score</span>
                  <Badge variant="outline" className="font-mono">
                    {scorableQuestions.length} questions
                  </Badge>
                </div>

                {scorableQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">
                          {index + 1}. {question.question_text}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Answer: <span className="text-foreground">{getAnswerDisplay(question.id)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          value={scores[question.id] ?? 0}
                          onChange={(e) => handleScoreChange(question.id, e.target.value)}
                          className="w-16 text-center font-mono"
                          disabled={isVerified}
                        />
                        <span className="text-sm text-muted-foreground">/ 10</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Score Summary */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Score Summary</span>
                {isVerified && (
                  <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{totalScore}</p>
                  <p className="text-xs text-muted-foreground">Total Score</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{maxScore}</p>
                  <p className="text-xs text-muted-foreground">Max Score</p>
                </div>
              <div>
                  <p className={`text-2xl font-bold ${
                    percentage >= 70 ? "text-emerald-600 dark:text-emerald-500" : 
                    percentage >= 40 ? "text-amber-600 dark:text-amber-500" : "text-destructive"
                  }`}>
                    {percentage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Percentage</p>
                </div>
              </div>

              {isVerified && (registration as any).verified_at && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  Verified on {format(new Date((registration as any).verified_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isVerified ? "Close" : "Cancel"}
          </Button>
          {!isVerified && scorableQuestions.length > 0 && (
            <Button onClick={handleSubmitVerification} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Verification
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
