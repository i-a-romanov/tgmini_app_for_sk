-- Proposed MVP model. Illustrative migration, not a connected production DB.
CREATE TABLE app_user (
  id uuid PRIMARY KEY,
  telegram_id bigint NOT NULL UNIQUE,
  first_name text NOT NULL,
  locale text NOT NULL DEFAULT 'ru',
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE app_session (
  token_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE preparation_plan (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES app_user ON DELETE CASCADE,
  goal text NOT NULL CHECK (goal IN ('grant','program','explore')),
  minutes_per_day int NOT NULL CHECK (minutes_per_day IN (10,15,25)),
  status text NOT NULL CHECK (status IN ('draft','active','paused')),
  template_version int NOT NULL,
  version int NOT NULL DEFAULT 1,
  activated_at timestamptz
);
CREATE TABLE task_definition (
  id uuid PRIMARY KEY,
  content_version int NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL,
  source_url text,
  reviewed_at timestamptz
);
CREATE TABLE plan_task (
  plan_id uuid NOT NULL REFERENCES preparation_plan ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES task_definition,
  position int NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (plan_id, task_id),
  UNIQUE (plan_id, position)
);
CREATE TABLE deadline (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  due_at timestamptz,
  display_timezone text NOT NULL DEFAULT 'Europe/Moscow',
  source_url text,
  verified_at timestamptz,
  status text NOT NULL CHECK (status IN ('unconfirmed','verified','withdrawn')),
  CHECK (status <> 'verified' OR
    (due_at IS NOT NULL AND source_url IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE reminder_preference (
  user_id uuid PRIMARY KEY REFERENCES app_user ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  write_access_confirmed boolean NOT NULL DEFAULT false,
  local_time time NOT NULL DEFAULT '19:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_delivery (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
  dedupe_key text NOT NULL UNIQUE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','sending','sent','failed','cancelled')),
  attempts int NOT NULL DEFAULT 0,
  last_error_code text
);
CREATE TABLE privacy_acknowledgement (
  user_id uuid NOT NULL REFERENCES app_user ON DELETE CASCADE,
  policy_version text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, policy_version)
);
