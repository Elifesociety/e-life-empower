import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FollowupType } from "@/lib/yesNoFollowup";
import type { ReactNode } from "react";

interface Props {
  id: string;
  type: FollowupType;
  options: string[];
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
}

export function FollowupInput({ id, type, options, label, value, onChange }: Props) {
  const first = value[0] || "";
  let control: ReactNode = null;

  if (type === "textarea") {
    control = <Textarea id={id} value={first} onChange={(e) => onChange([e.target.value])} rows={3} />;
  } else if (type === "select") {
    control = (
      <Select value={first} onValueChange={(v) => onChange([v])}>
        <SelectTrigger id={id}><SelectValue placeholder="Select an option" /></SelectTrigger>
        <SelectContent>{options.map((o, i) => <SelectItem key={i} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  } else if (type === "radio") {
    control = (
      <RadioGroup value={first} onValueChange={(v) => onChange([v])} className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <RadioGroupItem value={o} id={`${id}-${i}`} />
            <Label htmlFor={`${id}-${i}`}>{o}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  } else if (type === "checkbox") {
    control = (
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Checkbox
              id={`${id}-${i}`}
              checked={value.includes(o)}
              onCheckedChange={(c) => onChange(c ? [...value, o] : value.filter((x) => x !== o))}
            />
            <Label htmlFor={`${id}-${i}`}>{o}</Label>
          </div>
        ))}
      </div>
    );
  } else if (type === "multi_text") {
    const items = value.length > 0 ? value : [""];
    control = (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={item} placeholder={`Answer ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            {items.length > 1 && (
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove answer ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>+ Add Another Answer</Button>
      </div>
    );
  } else if (type === "yes_no") {
    control = (
      <div className="grid grid-cols-2 gap-2">
        {(["yes", "no"] as const).map((choice) => (
          <Button key={choice} type="button" variant={first === choice ? "default" : "outline"} onClick={() => onChange([choice])}>
            {choice === "yes" ? "Yes / അതെ" : "No / ഇല്ല"}
          </Button>
        ))}
      </div>
    );
  } else {
    control = (
      <Input id={id} type={type === "phone" ? "tel" : type} value={first} onChange={(e) => onChange([e.target.value])} />
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
      {label && <Label htmlFor={id} className="text-sm font-medium">{label}</Label>}
      {control}
    </div>
  );
}
