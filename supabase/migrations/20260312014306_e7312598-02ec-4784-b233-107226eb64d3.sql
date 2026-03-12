
CREATE TABLE public.old_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  category text DEFAULT '',
  fee_paid numeric DEFAULT 0,
  approved_by text DEFAULT '',
  approved_date text DEFAULT '',
  raw_data jsonb DEFAULT '{}',
  batch_id uuid DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.old_payments ENABLE ROW LEVEL SECURITY;

-- Public can search by mobile
CREATE POLICY "Public can check old payments by mobile"
  ON public.old_payments FOR SELECT TO public
  USING (true);

-- Super admin can manage
CREATE POLICY "Super admin can manage old payments"
  ON public.old_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_old_payments_mobile ON public.old_payments(mobile);
