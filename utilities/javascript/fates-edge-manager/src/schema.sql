CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY, username text NOT NULL, password_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  operator boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username ON accounts (lower(username));
CREATE TABLE IF NOT EXISTS sessions (
  digest text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
  csrf text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS external_identities (
  id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
  issuer text NOT NULL, subject text NOT NULL, UNIQUE(issuer,subject)
);
CREATE TABLE IF NOT EXISTS sso_transactions (
  digest text PRIMARY KEY, provider text NOT NULL, verifier text NOT NULL, state text NOT NULL,
  nonce text NOT NULL, link_account_id uuid REFERENCES accounts(id), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS managed_rooms (
  id uuid PRIMARY KEY, room_code text UNIQUE NOT NULL, name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','archived')),
  authz_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS room_memberships (
  id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES managed_rooms(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  role text NOT NULL CHECK(role IN ('gm','co-gm','assistant-gm','player','spectator')),
  control_role text NOT NULL DEFAULT 'member' CHECK(control_role IN ('owner','administrator','member')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','suspended','banned','left')),
  UNIQUE(room_id,account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS room_one_owner ON room_memberships(room_id) WHERE control_role='owner';
CREATE TABLE IF NOT EXISTS invitations (
  digest text PRIMARY KEY, membership_id uuid NOT NULL REFERENCES room_memberships(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY, membership_id uuid NOT NULL REFERENCES room_memberships(id),
  secret_digest text NOT NULL, display_prefix text NOT NULL, label text NOT NULL, scopes text[] NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','rotating','revoked')),
  expires_at timestamptz NOT NULL, last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS socket_nodes (
  server_id uuid PRIMARY KEY, name text UNIQUE NOT NULL, public_url text NOT NULL, region text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','draining','offline')),
  capacity_rooms integer NOT NULL CHECK(capacity_rooms > 0), last_heartbeat_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS room_placements (
  room_id uuid PRIMARY KEY REFERENCES managed_rooms(id), server_id uuid NOT NULL REFERENCES socket_nodes(server_id),
  placement_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','unavailable'))
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY, actor_account_id uuid REFERENCES accounts(id), room_id uuid REFERENCES managed_rooms(id),
  action text NOT NULL, target_id text, request_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS idempotency (
  account_id uuid NOT NULL REFERENCES accounts(id), key text NOT NULL, fingerprint text NOT NULL,
  PRIMARY KEY(account_id,key), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket text PRIMARY KEY, hits integer NOT NULL, resets_at timestamptz NOT NULL
);
