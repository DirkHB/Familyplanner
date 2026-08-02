-- Einmalige Übernahme der Erinnerungen-Liste "To Do C&D" (aus dem PDF vom 02.08.2026).
-- Apple gibt die modernisierte Liste über keine Schnittstelle heraus; die Daten kommen
-- deshalb als Migration mit. Jede Zeile prüft vorher, ob es Liste bzw. Aufgabe schon
-- gibt (auch von Hand eingefügt) — doppelt entsteht nichts.

-- Liste „Diese Woche“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_0', 'Diese Woche', 10, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Diese Woche'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_001', 'Fleurop Inka & Christian', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Fleurop Inka & Christian'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_002', 'E-Mail an Frau Sawatzki', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('E-Mail an Frau Sawatzki'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_003', 'Garagenöffner', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Garagenöffner'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_004', 'Pax Schrankböden', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Pax Schrankböden'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_005', 'Boxen aus Keller wegwerfen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Boxen aus Keller wegwerfen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_006', 'Elterngeld beantragen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Elterngeld beantragen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_007', 'Kinderarzttermin umlegen auf Freitag', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Kinderarzttermin umlegen auf Freitag'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_008', 'Ausdruck wegen Antrag Pass', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Ausdruck wegen Antrag Pass'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_009', 'Passfoto Nico', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Passfoto Nico'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_010', 'Fernseher runterbringen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Fernseher runterbringen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_011', 'Projekte Lovable zusammenführen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Projekte Lovable zusammenführen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_012', 'Termine klären', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Termine klären'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_013', 'Urlaub planen und nächste Woche besprechen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Urlaub planen und nächste Woche besprechen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_014', 'Babymassage Baby Poppins buchen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Babymassage Baby Poppins buchen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_015', 'Räder Termin?!', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Räder Termin?!'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_016', 'Franzi zu-/absagen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Franzi zu-/absagen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_017', 'Käfer Tisch', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Diese Woche') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Käfer Tisch'));

-- Liste „Warten auf Rückmeldung“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_1', 'Warten auf Rückmeldung', 11, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Warten auf Rückmeldung'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_018', 'Kindergeld beantragt – Rückmeldung offen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Warten auf Rückmeldung') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Kindergeld beantragt – Rückmeldung offen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_019', 'Konto eröffnen HVB und DB', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Warten auf Rückmeldung') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Konto eröffnen HVB und DB'));

-- Liste „Nicht so dringlich“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_2', 'Nicht so dringlich', 12, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Nicht so dringlich'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_020', 'Postkarten Dubai & Venedig', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht so dringlich') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Postkarten Dubai & Venedig'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_021', 'Rezept Pumpe', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht so dringlich') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Rezept Pumpe'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_022', 'Visa anrufen / Priority Pass', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht so dringlich') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Visa anrufen / Priority Pass'));

-- Liste „Constanze“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_3', 'Constanze', 13, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Constanze'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_023', 'Fotobuch Nicolas', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Fotobuch Nicolas'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_024', 'Fotobuch Hochzeit', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Fotobuch Hochzeit'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_025', 'Fotobuch die letzten 9 Monate', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Fotobuch die letzten 9 Monate'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_026', 'Bücherregal aufräumen, Bücherregal bestellen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Bücherregal aufräumen, Bücherregal bestellen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_027', 'Artnight Gutschein', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Artnight Gutschein'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_028', 'Kündigung Primetime Dirk PT 20.6', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Kündigung Primetime Dirk PT 20.6'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_029', 'Every pausiert – nächste Lieferung September?!', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Constanze') LIMIT 1), 'constanze', 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Every pausiert – nächste Lieferung September?!'));

-- Liste „Mit Mama erledigen“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_4', 'Mit Mama erledigen', 14, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Mit Mama erledigen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_030', 'Constanze/Dirk Schrank aufräumen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Mit Mama erledigen') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Constanze/Dirk Schrank aufräumen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_031', 'Dänemark DM in Euro tauschen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Mit Mama erledigen') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Dänemark DM in Euro tauschen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_032', 'Sachen bei Vinted einstellen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Mit Mama erledigen') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Sachen bei Vinted einstellen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_033', 'Keller / Tisch und Golfschläger / Wertstoffhof', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Mit Mama erledigen') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Keller / Tisch und Golfschläger / Wertstoffhof'));

-- Liste „Nicht dringend“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_5', 'Nicht dringend', 15, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_034', 'Waschmaschine und Trockner tauschen', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Waschmaschine und Trockner tauschen'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_035', 'Constanze Wellpass zum 1.9. wieder machen + Primetime Pausierung 1.8.', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Constanze Wellpass zum 1.9. wieder machen + Primetime Pausierung 1.8.'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_036', 'Sicherungskopien / Notfallkoffer', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Sicherungskopien / Notfallkoffer'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_037', 'Arbeitszeit analog Vereinbarung BMW für HB', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Arbeitszeit analog Vereinbarung BMW für HB'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_038', 'Gartenmöbel JYSK', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Gartenmöbel JYSK'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_039', 'Sicherungskopie Daten', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Nicht dringend') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Sicherungskopie Daten'));

-- Liste „Pakete“
INSERT INTO "todo_lists" ("id", "name", "sort_order", "createdAt")
SELECT 'tdl_seed_6', 'Pakete', 16, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todo_lists" WHERE lower("name") = lower('Pakete'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_040', '2x H&M', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('2x H&M'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_041', 'Black Friday', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Black Friday'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_042', 'Die Nussschale – Buch', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Die Nussschale – Buch'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_043', 'Miele Kochevent (miele.de/c/events-3353)', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Miele Kochevent (miele.de/c/events-3353)'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_044', 'Der Engel – Hotelgutschein', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Der Engel – Hotelgutschein'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_045', 'Eight Sleep', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Eight Sleep'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_046', 'Flüge & Hotels', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Flüge & Hotels'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_047', 'Longsleeve Dirk Sport', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Longsleeve Dirk Sport'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_048', 'Lange Laufhose', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Lange Laufhose'));
INSERT INTO "todos" ("id", "title", "list_id", "assignee", "createdBy", "status", "createdAt")
SELECT 'td_seed_049', 'Fairfax & Favor', (SELECT "id" FROM "todo_lists" WHERE lower("name") = lower('Pakete') LIMIT 1), NULL, 'dirk', 'offen', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "todos" WHERE lower("title") = lower('Fairfax & Favor'));

