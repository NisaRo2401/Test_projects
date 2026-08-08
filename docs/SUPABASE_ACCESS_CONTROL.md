# Supabase-Zugriffskontrolle des FIAE Lernhubs

Der Lernhub verwendet zwei getrennte Schutzschichten:

1. `assets/js/protect.js` leitet Besucher ohne gültige Supabase-Sitzung zur Anmeldung um.
2. Row-Level Security (RLS) schützt die Daten in Supabase unabhängig vom Browsercode.

Die HTML-, CSS- und JavaScript-Dateien selbst sind statische öffentliche Dateien. Vertrauliche Daten dürfen deshalb nie darin abgelegt werden. Der Supabase-Anon- beziehungsweise Publishable-Key ist für Browseranwendungen vorgesehen; der `service_role`-Key gehört ausschließlich in die lokale `tools/.env` des Importwerkzeugs.

## Datenbank einrichten

Die SQL-Dateien werden in dieser Reihenfolge im Supabase SQL Editor ausgeführt:

1. `docs/supabase-setup.sql`
2. `docs/ihk-exam-schema.sql`

Beide Dateien sind wiederholt ausführbar. Sie aktivieren RLS, erstellen die benötigten Policies und begrenzen die API-Rechte der Rollen `anon` und `authenticated`.

## Aktives Berechtigungsmodell

- Registrierte und bestätigte Nutzer dürfen öffentliche Prüfungsfragen lesen.
- Nutzer dürfen ausschließlich den eigenen Profil-, Lernfortschritts- und Prüfungsverlauf lesen oder verändern.
- Nicht angemeldete Nutzer erhalten über die Supabase-API keinen Zugriff auf diese Tabellen.
- Das Importwerkzeug schreibt mit dem serverseitigen Service-Role-Key und umgeht RLS nur für diesen administrativen Import.

## Registrierung steuern

Ob sich neue Nutzer selbst registrieren dürfen, wird in Supabase unter **Authentication → Providers → Email** gesteuert. Wenn nur eingeladene Nutzer Zugriff erhalten sollen, wird die öffentliche Registrierung dort deaktiviert und jeder Account administrativ angelegt oder eingeladen. Das ist sicherer als eine reine Freischaltliste im Browser, weil nicht freigeschaltete Konten dann gar keine gültige Sitzung erhalten.

## Kontrolle vor dem Livegang

Im Supabase-Dashboard müssen für die Produktionsdomain die **Site URL** und die erlaubten **Redirect URLs** korrekt gesetzt sein. Anschließend werden mindestens diese Fälle getestet:

- anonymer Tabellenzugriff wird abgewiesen;
- Nutzer A kann keine Daten von Nutzer B lesen oder ändern;
- Abmelden beendet die Sitzung;
- ein abgelaufener Login führt zurück zur Anmeldeseite;
- im ausgelieferten Frontend ist kein Service-Role-Key enthalten.
