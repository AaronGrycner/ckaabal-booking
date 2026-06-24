CREATE TABLE `outreach_signature_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`body_text` text DEFAULT '' NOT NULL,
	`attach_files_on_send` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outreach_email_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`content` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
