CREATE TABLE IF NOT EXISTS sk_schema_version (version int PRIMARY KEY);
CREATE TABLE IF NOT EXISTS sk_users (
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL UNIQUE,
  first_name text NOT NULL,
  goal text NOT NULL DEFAULT 'grant' CHECK (goal IN ('grant','program','explore')),
  pace int NOT NULL DEFAULT 15 CHECK (pace IN (10,15,25)),
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  reminder_time text NOT NULL DEFAULT '19:00',
  reminders boolean NOT NULL DEFAULT false,
  can_message boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sk_sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES sk_users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sk_sessions_expiry ON sk_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sk_task_progress (
  user_id bigint NOT NULL REFERENCES sk_users ON DELETE CASCADE,
  task_id text NOT NULL,
  answer jsonb NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);
CREATE TABLE IF NOT EXISTS sk_deadlines (
  id uuid PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES sk_users ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sk_deadlines_user ON sk_deadlines(user_id);
CREATE TABLE IF NOT EXISTS sk_deliveries (
  user_id bigint NOT NULL REFERENCES sk_users ON DELETE CASCADE,
  local_day text NOT NULL,
  status text NOT NULL CHECK (status IN ('claimed','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_day)
);
CREATE TABLE IF NOT EXISTS sk_bot_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sk_bot_contacts (
  telegram_id bigint PRIMARY KEY,
  can_message boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sk_downloads (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES sk_users ON DELETE CASCADE,
  deadline_id uuid NOT NULL REFERENCES sk_deadlines ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
INSERT INTO sk_schema_version(version) VALUES (1) ON CONFLICT DO NOTHING;
