ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT 'oklch(0.99 0.012 70)',
  ADD COLUMN IF NOT EXISTS card_background_color text NOT NULL DEFAULT 'oklch(1 0 0)',
  ADD COLUMN IF NOT EXISTS muted_background_color text NOT NULL DEFAULT 'oklch(0.96 0.012 60)',
  ADD COLUMN IF NOT EXISTS foreground_color text NOT NULL DEFAULT 'oklch(0.22 0.045 290)';