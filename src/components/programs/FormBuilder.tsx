import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, GripVertical, FileText, Loader2 } from "lucide-react";
import { ProgramFormQuestion } from "@/hooks/usePrograms";

interface FormBuilderProps {
  programId: string;
  questions: ProgramFormQuestion[];
  onQuestionsChange: () => void;
}

const QUESTION_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "phone", label: "Phone" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Single Choice (Radio)" },
  { value: "checkbox", label: "Multiple Choice (Checkbox)" },
  { value: "multi_text", label: "Multiple Answers (Add More)" },
];

export function FormBuilder({ programId, questions, onQuestionsChange }: FormBuilderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ProgramFormQuestion | null>(null);

  // Form state
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState("");

  const { toast } = useToast();
  const { adminToken } = useAuth();

  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  const resetForm = () => {
    setQuestionText("");
    setQuestionType("text");
    setIsRequired(false);
    setOptions("");
    setEditingQuestion(null);
  };

  const openEditDialog = (question: ProgramFormQuestion) => {
    setEditingQuestion(question);
    setQuestionText(question.question_text);
    setQuestionType(question.question_type);
    setIsRequired(question.is_required);
    setOptions(
      question.options ? (question.options as string[]).join("\n") : ""
    );
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!questionText.trim()) {
      toast({
        title: "Error",
        description: "Question text is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const questionData = {
        program_id: programId,
        question_text: questionText.trim(),
        question_type: questionType,
        is_required: isRequired,
        options:
          ["select", "radio", "checkbox"].includes(questionType) && options.trim()
            ? options
                .split("\n")
                .map((o) => o.trim())
                .filter(Boolean)
            : null,
        sort_order: editingQuestion?.sort_order ?? sortedQuestions.length,
      };

      const callAdminQuestionsApi = async (action: string, data: Record<string, unknown>) => {
        const response = await supabase.functions.invoke("admin-form-questions", {
          body: { action, data },
          headers: adminToken ? { "x-admin-token": adminToken } : {},
        });

        if (response.error) {
          throw new Error(response.error.message || "API call failed");
        }

        if ((response.data as any)?.error) {
          throw new Error((response.data as any).error);
        }

        return response.data;
      };

      if (editingQuestion) {
        if (adminToken) {
          await callAdminQuestionsApi("update", { id: editingQuestion.id, ...questionData });
        } else {
          const { error } = await supabase
            .from("program_form_questions")
            .update(questionData)
            .eq("id", editingQuestion.id);
          if (error) throw error;
        }

        toast({
          title: "Question updated",
          description: "The form question has been updated.",
        });
      } else {
        if (adminToken) {
          await callAdminQuestionsApi("create", questionData);
        } else {
          const { error } = await supabase
            .from("program_form_questions")
            .insert(questionData);
          if (error) throw error;
        }

        toast({
          title: "Question added",
          description: "A new form question has been added.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      onQuestionsChange();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    try {
      if (adminToken) {
        const response = await supabase.functions.invoke("admin-form-questions", {
          body: { action: "delete", data: { id: questionId } },
          headers: { "x-admin-token": adminToken },
        });

        if (response.error) throw new Error(response.error.message || "API call failed");
        if ((response.data as any)?.error) throw new Error((response.data as any).error);
      } else {
        const { error } = await supabase
          .from("program_form_questions")
          .delete()
          .eq("id", questionId);
        if (error) throw error;
      }

      toast({
        title: "Question deleted",
        description: "The form question has been removed.",
      });

      onQuestionsChange();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete question",
        variant: "destructive",
      });
    }
  };

  const needsOptions = ["select", "radio", "checkbox"].includes(questionType);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Registration Form
              </CardTitle>
              <CardDescription>
                Create custom form fields for program registration
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sortedQuestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No form questions yet.</p>
              <p className="text-sm">Add questions to create a registration form.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedQuestions.map((question, index) => (
                <div
                  key={question.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{question.question_text}</span>
                      {question.is_required && (
                        <span className="text-xs text-destructive">*Required</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {question.question_type.replace("_", " ")}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(question)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(question.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle>
              {editingQuestion ? "Edit Question" : "Add Question"}
            </DialogTitle>
            <DialogDescription>
              Configure the form field settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="questionText" className="text-sm font-medium">Question Text</Label>
              <Input
                id="questionText"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your question"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionType" className="text-sm font-medium">Question Type</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger className="text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <Label htmlFor="options" className="text-sm font-medium">Options (one per line)</Label>
                <Textarea
                  id="options"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={4}
                  className="text-base resize-none"
                />
              </div>
            )}

            <div className="flex items-center gap-3 py-2">
              <Switch
                id="isRequired"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
              <Label htmlFor="isRequired" className="text-sm font-medium cursor-pointer">Required field</Label>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingQuestion ? (
                "Update"
              ) : (
                "Add"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
