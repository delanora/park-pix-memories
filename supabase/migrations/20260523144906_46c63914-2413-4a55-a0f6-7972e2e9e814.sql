
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('operator', 'customer');
CREATE TYPE public.photo_status AS ENUM ('available', 'sold', 'deleted');

-- user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- customer_profiles
CREATE TABLE public.customer_profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  birthdate DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- photos
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storage_path TEXT NOT NULL UNIQUE,
  sequence_number BIGSERIAL NOT NULL UNIQUE,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status public.photo_status NOT NULL DEFAULT 'available',
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_photos_status_taken ON public.photos (status, taken_at DESC);
CREATE INDEX idx_photos_seq ON public.photos (sequence_number DESC);
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- sales
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_customer ON public.sales (customer_id, created_at DESC);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- sale_items
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  UNIQUE (sale_id, photo_id)
);
CREATE INDEX idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX idx_sale_items_photo ON public.sale_items (photo_id);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Operators see all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Customer sees own profile" ON public.customer_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Operators see all customer profiles" ON public.customer_profiles FOR SELECT USING (public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators see all photos" ON public.photos FOR SELECT USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Customers see purchased photos" ON public.photos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.photo_id = photos.id AND s.customer_id = auth.uid()
  )
);

CREATE POLICY "Operators see all sales" ON public.sales FOR SELECT USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Customers see own sales" ON public.sales FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Operators see all sale items" ON public.sale_items FOR SELECT USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Customers see own sale items" ON public.sale_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.customer_id = auth.uid())
);

-- "30 depois" trigger
CREATE OR REPLACE FUNCTION public.auto_delete_old_available_photos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.photos
     SET status = 'deleted', deleted_at = now()
   WHERE status = 'available'
     AND sequence_number <= NEW.sequence_number - 30;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_delete_old_photos
AFTER INSERT ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.auto_delete_old_available_photos();

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;
