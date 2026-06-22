-- Incremental migration for existing databases (run once if tables/columns are missing)
ALTER TABLE leads ADD COLUMN last_email_clicked_at integer;
ALTER TABLE leads ADD COLUMN email_click_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tracked_outreach_links (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  token text NOT NULL UNIQUE,
  lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  destination_url text NOT NULL,
  link_type text DEFAULT 'signature' NOT NULL,
  campaign text,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  last_clicked_at integer,
  click_count integer DEFAULT 0 NOT NULL,
  is_active integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_link_clicks (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  tracked_link_id integer NOT NULL REFERENCES tracked_outreach_links(id) ON DELETE CASCADE,
  lead_id integer NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  clicked_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
  user_agent text,
  referrer text,
  ip_hash text,
  country text,
  city text
);
