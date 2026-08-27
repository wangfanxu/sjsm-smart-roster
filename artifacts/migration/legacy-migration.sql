BEGIN;

SET LOCAL TIME ZONE 'UTC';

INSERT INTO users (id, firebase_uid, email, display_name, system_role, is_active) VALUES
  ('b4d22fe6-fe6c-4751-af47-34a0ba508451', 'synthetic:user-admin', 'admin@example.test', 'Alex Admin', 'administrator', TRUE),
  ('8ec9948d-7744-4e77-ae97-4cc07191b0f8', 'synthetic:user-leader', 'leader@example.test', 'Taylor Leader', 'team_leader', TRUE),
  ('7d266113-851c-4723-a75a-efe97913123d', 'synthetic:user-drummer-a', 'drummer.a@example.test', 'Jordan Rhythm', 'volunteer', TRUE),
  ('5602b943-5ad0-45f6-a582-b4cefe0f0dcd', 'synthetic:user-drummer-b', 'drummer.b@example.test', 'Morgan Beat', 'volunteer', TRUE),
  ('9970bcfa-7fa0-4a32-a9ce-efe8d4c83d44', 'synthetic:user-guitar', 'guitar@example.test', 'Casey Strings', 'volunteer', TRUE),
  ('2fb0dbb0-d8a5-404e-a08b-f4244762290e', 'synthetic:user-bass', 'bass@example.test', 'Riley Lowend', 'volunteer', TRUE),
  ('202eb0d7-58fa-45b8-aafa-69f7378b0880', 'synthetic:user-support', 'support@example.test', 'Jamie Harmony', 'volunteer', TRUE);

INSERT INTO roles (id, slug, name, description) VALUES
  ('06103a44-b4e3-43b9-a8a2-fc40bd89d985', 'bassist', 'Bassist', 'Imported from synthetic legacy fixture'),
  ('32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', 'drummer', 'Drummer', 'Imported from synthetic legacy fixture'),
  ('483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', 'guitarist', 'Guitarist', 'Imported from synthetic legacy fixture'),
  ('d8a57f71-96b7-4087-a183-09ada2027a73', 'lead-singer', 'Lead Singer', 'Imported from synthetic legacy fixture'),
  ('58c9b9fa-ec31-4db1-a1aa-9c931102b5b3', 'pa-operator', 'PA Operator', 'Imported from synthetic legacy fixture'),
  ('c89d6508-5241-4fc3-a1c9-0b3d3e296f2b', 'pianist', 'Pianist', 'Imported from synthetic legacy fixture'),
  ('db719189-9027-4f47-a241-08bee41f369f', 'projectionist', 'Projectionist', 'Imported from synthetic legacy fixture'),
  ('bdfec069-a070-472e-a261-e3a243ade5f8', 'supporting-singer', 'Supporting Singer', 'Imported from synthetic legacy fixture');

INSERT INTO user_roles (user_id, role_id, proficiency) VALUES
  ('b4d22fe6-fe6c-4751-af47-34a0ba508451', 'c89d6508-5241-4fc3-a1c9-0b3d3e296f2b', 'primary'),
  ('b4d22fe6-fe6c-4751-af47-34a0ba508451', 'db719189-9027-4f47-a241-08bee41f369f', 'secondary'),
  ('8ec9948d-7744-4e77-ae97-4cc07191b0f8', 'd8a57f71-96b7-4087-a183-09ada2027a73', 'primary'),
  ('8ec9948d-7744-4e77-ae97-4cc07191b0f8', 'bdfec069-a070-472e-a261-e3a243ade5f8', 'secondary'),
  ('7d266113-851c-4723-a75a-efe97913123d', '32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', 'primary'),
  ('5602b943-5ad0-45f6-a582-b4cefe0f0dcd', '32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', 'primary'),
  ('9970bcfa-7fa0-4a32-a9ce-efe8d4c83d44', '483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', 'primary'),
  ('9970bcfa-7fa0-4a32-a9ce-efe8d4c83d44', '06103a44-b4e3-43b9-a8a2-fc40bd89d985', 'secondary'),
  ('2fb0dbb0-d8a5-404e-a08b-f4244762290e', '06103a44-b4e3-43b9-a8a2-fc40bd89d985', 'primary'),
  ('2fb0dbb0-d8a5-404e-a08b-f4244762290e', '483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', 'secondary'),
  ('202eb0d7-58fa-45b8-aafa-69f7378b0880', 'bdfec069-a070-472e-a261-e3a243ade5f8', 'primary');

INSERT INTO planning_periods (id, name, starts_on, ends_on, status, created_by) VALUES
  ('516afcbc-844e-41e1-a986-5bb555c07eec', 'Synthetic September–October 2026', '2026-09-01', '2026-10-31', 'draft', 'b4d22fe6-fe6c-4751-af47-34a0ba508451');

INSERT INTO services (id, planning_period_id, title, starts_at, notes) VALUES
  ('d174d792-4da5-4533-a380-f865b81e6a69', '516afcbc-844e-41e1-a986-5bb555c07eec', 'Synthetic Worship Service', '2026-09-05T09:00:00+08:00', 'Generated fixture only'),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', '516afcbc-844e-41e1-a986-5bb555c07eec', 'Synthetic Communion Service', '2026-09-12T09:00:00+08:00', 'Generated fixture only');

INSERT INTO service_role_requirements (service_id, role_id, required_count) VALUES
  ('d174d792-4da5-4533-a380-f865b81e6a69', 'd8a57f71-96b7-4087-a183-09ada2027a73', 1),
  ('d174d792-4da5-4533-a380-f865b81e6a69', 'bdfec069-a070-472e-a261-e3a243ade5f8', 1),
  ('d174d792-4da5-4533-a380-f865b81e6a69', 'c89d6508-5241-4fc3-a1c9-0b3d3e296f2b', 1),
  ('d174d792-4da5-4533-a380-f865b81e6a69', '32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', 1),
  ('d174d792-4da5-4533-a380-f865b81e6a69', '483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', 1),
  ('d174d792-4da5-4533-a380-f865b81e6a69', '06103a44-b4e3-43b9-a8a2-fc40bd89d985', 1),
  ('d174d792-4da5-4533-a380-f865b81e6a69', '58c9b9fa-ec31-4db1-a1aa-9c931102b5b3', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', 'd8a57f71-96b7-4087-a183-09ada2027a73', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', 'bdfec069-a070-472e-a261-e3a243ade5f8', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', 'c89d6508-5241-4fc3-a1c9-0b3d3e296f2b', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', '32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', '483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', '06103a44-b4e3-43b9-a8a2-fc40bd89d985', 1),
  ('572b016a-aee8-4130-a9a7-ad3416de7477', '58c9b9fa-ec31-4db1-a1aa-9c931102b5b3', 1);

INSERT INTO availability (user_id, service_date, status, note, updated_by) VALUES
  ('202eb0d7-58fa-45b8-aafa-69f7378b0880', '2026-09-12', 'unavailable', 'Synthetic conflict', '202eb0d7-58fa-45b8-aafa-69f7378b0880');

INSERT INTO roster_candidates (id, planning_period_id, version, status, hard_constraints_satisfied, objective_score, configuration, explanation, created_by) VALUES
  ('5420711c-c2f1-4749-ab8a-aa61628f5375', '516afcbc-844e-41e1-a986-5bb555c07eec', 1, 'draft', TRUE, NULL, '{"source":"synthetic-legacy-migration-spike"}'::jsonb, '{"note":"Legacy manual assignments imported as a draft candidate"}'::jsonb, 'b4d22fe6-fe6c-4751-af47-34a0ba508451');

INSERT INTO assignments (id, candidate_id, service_id, role_id, user_id, is_locked, source) VALUES
  ('7f50829e-be8d-4c75-a3ed-193cac4bf2f3', '5420711c-c2f1-4749-ab8a-aa61628f5375', 'd174d792-4da5-4533-a380-f865b81e6a69', 'd8a57f71-96b7-4087-a183-09ada2027a73', '8ec9948d-7744-4e77-ae97-4cc07191b0f8', FALSE, 'manual'),
  ('7c73fe36-4117-42a2-abf6-c6a0d27bea84', '5420711c-c2f1-4749-ab8a-aa61628f5375', 'd174d792-4da5-4533-a380-f865b81e6a69', 'bdfec069-a070-472e-a261-e3a243ade5f8', '202eb0d7-58fa-45b8-aafa-69f7378b0880', FALSE, 'manual'),
  ('780e9219-20a4-4a27-a415-94256d789a2b', '5420711c-c2f1-4749-ab8a-aa61628f5375', 'd174d792-4da5-4533-a380-f865b81e6a69', 'c89d6508-5241-4fc3-a1c9-0b3d3e296f2b', 'b4d22fe6-fe6c-4751-af47-34a0ba508451', FALSE, 'manual'),
  ('0078d704-305b-4466-a54f-6a624d5fc878', '5420711c-c2f1-4749-ab8a-aa61628f5375', 'd174d792-4da5-4533-a380-f865b81e6a69', '32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', '7d266113-851c-4723-a75a-efe97913123d', FALSE, 'manual'),
  ('e4f89c91-ad1e-42ae-aa7b-974da5d62f79', '5420711c-c2f1-4749-ab8a-aa61628f5375', 'd174d792-4da5-4533-a380-f865b81e6a69', '483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', '9970bcfa-7fa0-4a32-a9ce-efe8d4c83d44', FALSE, 'manual'),
  ('b55a0287-00ab-4683-abd4-c150565e744f', '5420711c-c2f1-4749-ab8a-aa61628f5375', 'd174d792-4da5-4533-a380-f865b81e6a69', '06103a44-b4e3-43b9-a8a2-fc40bd89d985', '2fb0dbb0-d8a5-404e-a08b-f4244762290e', FALSE, 'manual'),
  ('5ffefafa-116b-46be-ac59-47e34fdb50b9', '5420711c-c2f1-4749-ab8a-aa61628f5375', '572b016a-aee8-4130-a9a7-ad3416de7477', 'd8a57f71-96b7-4087-a183-09ada2027a73', '8ec9948d-7744-4e77-ae97-4cc07191b0f8', FALSE, 'manual'),
  ('5c902151-9e22-4b16-af2e-30595e126af8', '5420711c-c2f1-4749-ab8a-aa61628f5375', '572b016a-aee8-4130-a9a7-ad3416de7477', 'c89d6508-5241-4fc3-a1c9-0b3d3e296f2b', 'b4d22fe6-fe6c-4751-af47-34a0ba508451', FALSE, 'manual'),
  ('1c97edfe-54a6-4f81-a478-c1e6dce2afb4', '5420711c-c2f1-4749-ab8a-aa61628f5375', '572b016a-aee8-4130-a9a7-ad3416de7477', '32f6c7ec-4fc7-4e04-a152-bf18c6eb28ba', '7d266113-851c-4723-a75a-efe97913123d', FALSE, 'manual'),
  ('2b7a691c-2497-4bc3-a354-fe9474bd60ed', '5420711c-c2f1-4749-ab8a-aa61628f5375', '572b016a-aee8-4130-a9a7-ad3416de7477', '483d7ebc-7b5e-4b1c-aea2-76583e82fcd0', '9970bcfa-7fa0-4a32-a9ce-efe8d4c83d44', FALSE, 'manual'),
  ('5edbcb4e-ba36-4a91-a585-8d4c8e01fec5', '5420711c-c2f1-4749-ab8a-aa61628f5375', '572b016a-aee8-4130-a9a7-ad3416de7477', '06103a44-b4e3-43b9-a8a2-fc40bd89d985', '2fb0dbb0-d8a5-404e-a08b-f4244762290e', FALSE, 'manual');

INSERT INTO replacement_requests (id, assignment_id, requester_id, replacement_user_id, status, reason) VALUES
  ('00819e6b-99af-4556-a942-a274143abfb2', '1c97edfe-54a6-4f81-a478-c1e6dce2afb4', '7d266113-851c-4723-a75a-efe97913123d', '5602b943-5ad0-45f6-a582-b4cefe0f0dcd', 'open', 'Synthetic replacement request');

INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, metadata) VALUES
  ('fa2781bf-9c59-49e8-af4c-b7a70e599e61', 'b4d22fe6-fe6c-4751-af47-34a0ba508451', 'legacy_fixture.transformed', 'planning_period', '516afcbc-844e-41e1-a986-5bb555c07eec', '{"synthetic":true,"fixtureVersion":1,"sourceCollections":{"users":7,"events":2,"availability":1,"serviceRequests":1}}'::jsonb);

COMMIT;
