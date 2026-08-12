import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, FileText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrainingLesson } from "@/lib/trainingsApi";

function ImagePresentation({ images }: { images: { url: string; caption?: string }[] }) {
  const [index, setIndex] = useState(0);
  if (!images.length) return <EmptyLesson label="No images added yet" />;
  const current = images[Math.min(index, images.length - 1)];
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <img src={current.url} alt={current.caption || `Slide ${index + 1}`} className="w-full max-h-[60vh] object-contain bg-background" />
        <div className="absolute inset-y-0 left-0 flex items-center p-2">
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => go(-1)} aria-label="Previous slide">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center p-2">
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => go(1)} aria-label="Next slide">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="absolute bottom-2 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">
          {index + 1} / {images.length}
        </span>
      </div>
      {current.caption && <p className="text-sm text-muted-foreground text-center">{current.caption}</p>}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={cn(
              "h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 transition",
              i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
            )}
          >
            <img src={img.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyLesson({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function LessonViewer({ lesson }: { lesson: TrainingLesson }) {
  const content = lesson.content || {};

  if (lesson.lesson_type === "youtube") {
    if (!content.youtube_id) return <EmptyLesson label="No video linked" />;
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${content.youtube_id}`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (lesson.lesson_type === "images") {
    return <ImagePresentation images={content.images || []} />;
  }

  if (lesson.lesson_type === "pdf") {
    if (!content.file_url) return <EmptyLesson label="No slide deck uploaded" />;
    return (
      <div className="space-y-3">
        <div className="h-[65vh] w-full overflow-hidden rounded-xl border bg-muted">
          <iframe src={`${content.file_url}#view=FitH`} title={lesson.title} className="h-full w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={content.file_url} target="_blank" rel="noreferrer">
              <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={content.file_url} download>
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (lesson.lesson_type === "ppt") {
    if (!content.file_url) return <EmptyLesson label="No presentation uploaded" />;
    const officeViewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(content.file_url)}`;
    return (
      <div className="space-y-3">
        <div className="h-[65vh] w-full overflow-hidden rounded-xl border bg-muted">
          <iframe src={officeViewer} title={lesson.title} className="h-full w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Presentation className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{content.file_name || "Presentation"}</span>
          <Button variant="outline" size="sm" asChild className="ml-auto">
            <a href={content.file_url} download>
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <FileText className="h-4 w-4" /> Notes
      </div>
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
        {content.notes || "No notes added yet."}
      </div>
    </div>
  );
}
