-- Profiles-Tabelle: speichert Nutzerdaten für jeden registrierten User
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_login   TIMESTAMPTZ
);

-- Row-Level Security aktivieren: jeder Nutzer sieht nur seinen eigenen Eintrag
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer lesen eigenes Profil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Nutzer aktualisieren eigenes Profil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: legt automatisch einen Profil-Eintrag an, wenn sich jemand registriert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
