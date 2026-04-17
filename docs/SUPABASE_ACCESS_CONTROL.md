# Supabase Access Control für Test_projects

Diese Anleitung zeigt dir, wie du eine Zugriffs-Tabelle in Supabase einrichtest, damit nur freigeschaltete Nutzer auf deine Seiten zugreifen können.

## 1. Tabelle `allowed_users` erstellen

Führe im SQL-Editor von Supabase folgenden Befehl aus:

```sql
create table allowed_users (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  role text,
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc', now())
);
```

## 2. Row-Level Security aktivieren

```sql
alter table allowed_users enable row level security;
```

## 3. Policy für erlaubte Benutzer

Diese Policy sorgt dafür, dass eingeloggte Nutzer nur ihre eigene Zeile lesen können:

```sql
create policy "Allow active user access" on allowed_users
  for select using (
    active = true
    and email = current_setting('request.jwt.claims', true) ->> 'email'
  );
```

## 4. Verwalten der freigeschalteten Nutzer

Wenn ein Nutzer sich registriert und du ihn freischalten möchtest, musst du seine `user_id` und `email` in die Tabelle eintragen.

### Beispiel, nachdem ein Nutzer registriert wurde:

```sql
insert into allowed_users (user_id, email, role, active)
values (
  'deine-user-id-hier',
  'user@example.com',
  'member',
  true
);
```

## 5. Nutzer ohne Freischaltung blockieren

- Nutzer können sich registrieren, aber sie erhalten erst Zugriff, wenn ein Eintrag in `allowed_users` existiert.
- Wenn sie nicht freigeschaltet sind, werden sie beim Aufruf einer geschützten Seite automatisch zurück auf die Login-Seite geleitet.

## 6. Hinweise zur Nutzung

- Die Login-Daten werden weiterhin von Supabase Auth verwaltet.
- Die zusätzliche Tabelle `allowed_users` dient nur als Freischaltungs-Liste.
- Achte darauf, dass der `anon`-Key nur für öffentlichen Zugriff verwendet wird. Er darf nicht `service_role` sein.

## 7. Optional: User manuell freischalten

So kannst du Nutzer nachträglich erlauben oder sperren:

```sql
update allowed_users set active = true where email = 'user@example.com';
update allowed_users set active = false where email = 'user@example.com';
```

Das ist alles, was du brauchst, um den Seitenzugriff in deinem Projekt zu steuern.
