import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Globe, Loader2 } from "lucide-react";

interface Division {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

interface AccessibleDivisionsCardProps {
  primaryDivisionId: string;
  accessAllDivisions: boolean;
  additionalDivisionIds: string[];
}

export function AccessibleDivisionsCard({
  primaryDivisionId,
  accessAllDivisions,
  additionalDivisionIds,
}: AccessibleDivisionsCardProps) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        let query = supabase
          .from("divisions")
          .select("id, name, description, color")
          .eq("is_active", true)
          .order("name");

        if (!accessAllDivisions) {
          const ids = [primaryDivisionId, ...additionalDivisionIds];
          query = query.in("id", ids);
        }

        const { data } = await query;
        setDivisions(data || []);
      } catch (err) {
        console.error("Error fetching divisions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDivisions();
  }, [primaryDivisionId, accessAllDivisions, additionalDivisionIds]);

  // Don't show this card if admin only has primary division access
  if (!accessAllDivisions && additionalDivisionIds.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Accessible Divisions
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm flex items-center gap-1.5">
          {accessAllDivisions ? (
            <>
              <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Access to all divisions</span>
            </>
          ) : (
            `Access to ${divisions.length} division${divisions.length !== 1 ? "s" : ""}`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
            {divisions.map((division) => (
              <div
                key={division.id}
                className="flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border"
              >
                <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 flex-shrink-0">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-xs sm:text-sm truncate">
                      {division.name}
                    </p>
                    {division.id === primaryDivisionId && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Primary
                      </Badge>
                    )}
                  </div>
                  {division.description && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {division.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
