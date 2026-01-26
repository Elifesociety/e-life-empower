import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Panchayath {
  id: string;
  name: string;
  ward: string | null;
}

export interface FixedFieldValues {
  name: string;
  mobile: string;
  panchayath_id: string;
  panchayath_name: string;
  ward: string;
}

interface FixedRegistrationFieldsProps {
  values: FixedFieldValues;
  onChange: (values: FixedFieldValues) => void;
  errors?: Partial<Record<keyof FixedFieldValues, string>>;
}

export function FixedRegistrationFields({
  values,
  onChange,
  errors,
}: FixedRegistrationFieldsProps) {
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [isLoadingPanchayaths, setIsLoadingPanchayaths] = useState(true);

  // Fetch panchayaths on mount
  useEffect(() => {
    const fetchPanchayaths = async () => {
      const { data, error } = await supabase
        .from("panchayaths")
        .select("id, name, ward")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setPanchayaths(data);
      }
      setIsLoadingPanchayaths(false);
    };

    fetchPanchayaths();
  }, []);

  // Update wards when panchayath changes
  useEffect(() => {
    if (values.panchayath_id) {
      const selectedPanchayath = panchayaths.find(
        (p) => p.id === values.panchayath_id
      );
      if (selectedPanchayath?.ward) {
        // Parse ward numbers - assuming format like "1-15" or "1,2,3,4,5"
        const wardString = selectedPanchayath.ward;
        let wardList: string[] = [];

        if (wardString.includes("-")) {
          // Range format: "1-15"
          const [start, end] = wardString.split("-").map((n) => parseInt(n.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              wardList.push(String(i));
            }
          }
        } else if (wardString.includes(",")) {
          // Comma separated: "1,2,3,4,5"
          wardList = wardString.split(",").map((w) => w.trim());
        } else {
          // Single ward or custom format
          wardList = [wardString.trim()];
        }

        setWards(wardList);
      } else {
        // Generate default wards 1-20 if no ward info
        setWards(Array.from({ length: 20 }, (_, i) => String(i + 1)));
      }
    } else {
      setWards([]);
    }
  }, [values.panchayath_id, panchayaths]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...values, name: e.target.value });
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits and limit to 10
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange({ ...values, mobile: value });
  };

  const handlePanchayathChange = (panchayathId: string) => {
    const selectedPanchayath = panchayaths.find((p) => p.id === panchayathId);
    onChange({
      ...values,
      panchayath_id: panchayathId,
      panchayath_name: selectedPanchayath?.name || "",
      ward: "", // Reset ward when panchayath changes
    });
  };

  const handleWardChange = (ward: string) => {
    onChange({ ...values, ward });
  };

  return (
    <div className="space-y-6">
      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="fixed-name">
          Name
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id="fixed-name"
          value={values.name}
          onChange={handleNameChange}
          placeholder="Enter your full name"
          className={errors?.name ? "border-destructive" : ""}
        />
        {errors?.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      {/* Mobile Number Field */}
      <div className="space-y-2">
        <Label htmlFor="fixed-mobile">
          Mobile Number
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Input
          id="fixed-mobile"
          type="tel"
          value={values.mobile}
          onChange={handleMobileChange}
          placeholder="Enter 10-digit mobile number"
          maxLength={10}
          className={errors?.mobile ? "border-destructive" : ""}
        />
        {errors?.mobile && (
          <p className="text-sm text-destructive">{errors.mobile}</p>
        )}
      </div>

      {/* Panchayath Field */}
      <div className="space-y-2">
        <Label htmlFor="fixed-panchayath">
          Panchayath
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Select
          value={values.panchayath_id}
          onValueChange={handlePanchayathChange}
          disabled={isLoadingPanchayaths}
        >
          <SelectTrigger className={errors?.panchayath_id ? "border-destructive" : ""}>
            <SelectValue
              placeholder={isLoadingPanchayaths ? "Loading..." : "Select panchayath"}
            />
          </SelectTrigger>
          <SelectContent>
            {panchayaths.map((panchayath) => (
              <SelectItem key={panchayath.id} value={panchayath.id}>
                {panchayath.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.panchayath_id && (
          <p className="text-sm text-destructive">{errors.panchayath_id}</p>
        )}
      </div>

      {/* Ward Field */}
      <div className="space-y-2">
        <Label htmlFor="fixed-ward">
          Ward
          <span className="text-destructive ml-1">*</span>
        </Label>
        <Select
          value={values.ward}
          onValueChange={handleWardChange}
          disabled={!values.panchayath_id || wards.length === 0}
        >
          <SelectTrigger className={errors?.ward ? "border-destructive" : ""}>
            <SelectValue
              placeholder={
                !values.panchayath_id
                  ? "Select panchayath first"
                  : "Select ward"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {wards.map((ward) => (
              <SelectItem key={ward} value={ward}>
                Ward {ward}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.ward && (
          <p className="text-sm text-destructive">{errors.ward}</p>
        )}
      </div>
    </div>
  );
}

export const FIXED_FIELD_DEFAULTS: FixedFieldValues = {
  name: "",
  mobile: "",
  panchayath_id: "",
  panchayath_name: "",
  ward: "",
};

export function validateFixedFields(
  values: FixedFieldValues
): { valid: boolean; errors: Partial<Record<keyof FixedFieldValues, string>> } {
  const errors: Partial<Record<keyof FixedFieldValues, string>> = {};

  if (!values.name.trim()) {
    errors.name = "Name is required";
  }

  if (!values.mobile) {
    errors.mobile = "Mobile number is required";
  } else if (values.mobile.length !== 10) {
    errors.mobile = "Mobile number must be 10 digits";
  }

  if (!values.panchayath_id) {
    errors.panchayath_id = "Please select a panchayath";
  }

  if (!values.ward) {
    errors.ward = "Please select a ward";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
