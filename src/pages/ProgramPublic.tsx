import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, MapPin, ArrowLeft, Check, Megaphone, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Program, ProgramFormQuestion, ProgramAnnouncement, ProgramAdvertisement } from "@/hooks/usePrograms";
import {
  FixedRegistrationFields,
  FixedFieldValues,
  FIXED_FIELD_DEFAULTS,
  validateFixedFields,
} from "@/components/programs/FixedRegistrationFields";

export default function ProgramPublicPage() {
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [fixedFields, setFixedFields] = useState<FixedFieldValues>(FIXED_FIELD_DEFAULTS);
  const [fixedFieldErrors, setFixedFieldErrors] = useState<Partial<Record<keyof FixedFieldValues, string>>>({});

  const { toast } = useToast();

  useEffect(() => {
    const fetchProgram = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("programs")
        .select(`
          *,
          division:divisions(name, color),
          panchayath:panchayaths(name),
          modules:program_modules(*),
          announcements:program_announcements(*),
          advertisements:program_advertisements(*),
          form_questions:program_form_questions(*)
        `)
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching program:", error);
      }

      setProgram(data);
      setIsLoading(false);
    };

    fetchProgram();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!program) return;

    // Validate fixed fields first
    const fixedValidation = validateFixedFields(fixedFields);
    if (!fixedValidation.valid) {
      setFixedFieldErrors(fixedValidation.errors);
      toast({
        title: "Required field",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setFixedFieldErrors({});

    // Validate custom required fields
    const sortedQuestions = (program.form_questions || []).sort(
      (a, b) => a.sort_order - b.sort_order
    );

    for (const question of sortedQuestions) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (
          answer === undefined ||
          answer === null ||
          answer === "" ||
          (Array.isArray(answer) && answer.length === 0)
        ) {
          toast({
            title: "Required field",
            description: `Please fill in: ${question.question_text}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Combine fixed fields with custom answers
      const combinedAnswers = {
        _fixed: {
          name: fixedFields.name,
          mobile: fixedFields.mobile,
          panchayath_id: fixedFields.panchayath_id,
          panchayath_name: fixedFields.panchayath_name,
          ward: fixedFields.ward,
        },
        ...answers,
      };

      const { error } = await supabase.from("program_registrations").insert({
        program_id: program.id,
        answers: combinedAnswers,
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Registration successful!",
        description: "Thank you for registering for this program.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to submit registration",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const renderFormField = (question: ProgramFormQuestion) => {
    const value = answers[question.id];
    const options = (question.options as string[]) || [];

    switch (question.question_type) {
      case "text":
        return (
          <Input
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
            rows={4}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="Enter a number"
          />
        );

      case "email":
        return (
          <Input
            type="email"
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="your@email.com"
          />
        );

      case "phone":
        return (
          <Input
            type="tel"
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder="+91 XXXXXXXXXX"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
          />
        );

      case "select":
        return (
          <Select value={value || ""} onValueChange={(v) => updateAnswer(question.id, v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, idx) => (
                <SelectItem key={idx} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={(v) => updateAnswer(question.id, v)}
            className="space-y-2"
          >
            {options.map((option, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <RadioGroupItem value={option} id={`${question.id}-${idx}`} />
                <Label htmlFor={`${question.id}-${idx}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {options.map((option, idx) => {
              const checkedValues = (value as string[]) || [];
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Checkbox
                    id={`${question.id}-${idx}`}
                    checked={checkedValues.includes(option)}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...checkedValues, option]
                        : checkedValues.filter((v) => v !== option);
                      updateAnswer(question.id, newValues);
                    }}
                  />
                  <Label htmlFor={`${question.id}-${idx}`}>{option}</Label>
                </div>
              );
            })}
          </div>
        );

      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
          />
        );
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

  if (!program) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">
              Program not found or is no longer available
            </p>
            <Button asChild className="mt-4">
              <Link to="/programs">Browse Programs</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Get published modules
  const publishedAnnouncements = (program.announcements || []).filter((a) => a.is_published);
  const publishedAds = (program.advertisements || []).filter((a) => a.is_published);
  const hasRegistrationModule = program.modules?.some(
    (m) => m.module_type === "registration" && m.is_published
  );
  const sortedQuestions = (program.form_questions || []).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        {/* Back button */}
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/programs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programs
          </Link>
        </Button>

        {/* Program Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Badge
              variant="secondary"
              style={{
                backgroundColor: program.division?.color || undefined,
                color: program.division?.color ? "white" : undefined,
              }}
            >
              {program.division?.name}
            </Badge>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">{program.name}</h1>
          {program.description && (
            <p className="text-lg text-muted-foreground mb-4">{program.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            {program.start_date && (
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(new Date(program.start_date), "MMMM d, yyyy")}
                {program.end_date &&
                  ` - ${format(new Date(program.end_date), "MMMM d, yyyy")}`}
              </span>
            )}
            {program.panchayath?.name && (
              <span className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {program.panchayath.name}
              </span>
            )}
            {program.all_panchayaths && (
              <span className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Available in all panchayaths
              </span>
            )}
          </div>
        </div>

        {/* Advertisements */}
        {publishedAds.length > 0 && (
          <div className="mb-8 space-y-4">
            {publishedAds.map((ad) => (
              <Card key={ad.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {ad.poster_url && (
                    <div className="md:w-1/3">
                      <img
                        src={ad.poster_url}
                        alt={ad.title || "Advertisement"}
                        className="w-full h-48 md:h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent
                    className={`flex-1 py-6 ${ad.poster_url ? "" : "md:col-span-2"}`}
                  >
                    {ad.title && (
                      <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        {ad.title}
                      </h3>
                    )}
                    {ad.description && (
                      <p className="text-muted-foreground">{ad.description}</p>
                    )}
                    {ad.video_url && (
                      <Button asChild variant="link" className="px-0 mt-2">
                        <a
                          href={ad.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Watch Video
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Announcements */}
        {publishedAnnouncements.length > 0 && (
          <div className="mb-8 space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" />
              Announcements
            </h2>
            {publishedAnnouncements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader>
                  <CardTitle>{announcement.title}</CardTitle>
                  <CardDescription>
                    {format(new Date(announcement.created_at), "MMMM d, yyyy")}
                  </CardDescription>
                </CardHeader>
                {(announcement.description || announcement.poster_url) && (
                  <CardContent>
                    {announcement.poster_url && (
                      <img
                        src={announcement.poster_url}
                        alt={announcement.title}
                        className="w-full max-w-md rounded-lg mb-4"
                      />
                    )}
                    {announcement.description && (
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {announcement.description}
                      </p>
                    )}
                    {announcement.video_url && (
                      <Button asChild variant="link" className="px-0 mt-2">
                        <a
                          href={announcement.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Watch Video
                        </a>
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Registration Form */}
        {hasRegistrationModule && (
          <Card>
            <CardHeader>
              <CardTitle>Register for this Program</CardTitle>
              <CardDescription>
                Fill out the form below to register. Fields marked with * are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                    <Check className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Registration Successful!</h3>
                  <p className="text-muted-foreground">
                    Thank you for registering. We will contact you with more details soon.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Fixed Required Fields */}
                  <FixedRegistrationFields
                    values={fixedFields}
                    onChange={setFixedFields}
                    errors={fixedFieldErrors}
                  />

                  {/* Separator if there are custom questions */}
                  {sortedQuestions.length > 0 && (
                    <div className="border-t pt-6">
                      <p className="text-sm text-muted-foreground mb-4">Additional Information</p>
                    </div>
                  )}

                  {/* Custom Questions */}
                  {sortedQuestions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <Label>
                        {question.question_text}
                        {question.is_required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>
                      {renderFormField(question)}
                    </div>
                  ))}
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Registration"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* No registration available message */}
        {!hasRegistrationModule && publishedAnnouncements.length === 0 && publishedAds.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No registration or announcements available for this program at the moment.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
