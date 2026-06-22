CREATE TABLE `gmail_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`activity_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`contact_method` text,
	`summary` text NOT NULL,
	`metadata_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`search_run_id` integer,
	`business_name` text NOT NULL,
	`category` text,
	`address` text,
	`city` text,
	`phone` text,
	`contact_email` text,
	`email_confidence` text,
	`email_source` text,
	`website_url` text,
	`maps_url` text,
	`rating` text,
	`review_count` integer,
	`source_query` text NOT NULL,
	`source_type` text DEFAULT 'google_places' NOT NULL,
	`source_run_id` integer,
	`review_status` text DEFAULT 'unreviewed' NOT NULL,
	`reviewed_at` integer,
	`rejection_reason` text,
	`outcome` text DEFAULT 'none' NOT NULL,
	`instagram_url` text,
	`facebook_url` text,
	`linkedin_url` text,
	`status` text DEFAULT 'new' NOT NULL,
	`audit_status` text DEFAULT 'pending' NOT NULL,
	`fit_score` integer,
	`fit_label` text,
	`main_issue` text,
	`notes` text,
	`first_contacted_at` integer,
	`last_contacted_at` integer,
	`follow_up_due_at` integer,
	`last_contact_method` text,
	`reply_received_at` integer,
	`last_email_clicked_at` integer,
	`email_click_count` integer DEFAULT 0 NOT NULL,
	`outreach_draft_subject` text,
	`outreach_draft_body` text,
	`outreach_draft_updated_at` integer,
	`on_call_list` integer DEFAULT false NOT NULL,
	`call_list_added_at` integer,
	`business_hours` text,
	`dedupe_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`search_run_id`) REFERENCES `search_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_dedupe_key_unique` ON `leads` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `outreach_link_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracked_link_id` integer NOT NULL,
	`lead_id` integer NOT NULL,
	`clicked_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_agent` text,
	`referrer` text,
	`ip_hash` text,
	`country` text,
	`city` text,
	FOREIGN KEY (`tracked_link_id`) REFERENCES `tracked_outreach_links`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `search_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`location` text NOT NULL,
	`max_results` integer NOT NULL,
	`total_found` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracked_outreach_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`lead_id` integer NOT NULL,
	`destination_url` text NOT NULL,
	`link_type` text DEFAULT 'signature' NOT NULL,
	`campaign` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_clicked_at` integer,
	`click_count` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_outreach_links_token_unique` ON `tracked_outreach_links` (`token`);--> statement-breakpoint
CREATE TABLE `website_audits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`url` text NOT NULL,
	`http_status` integer,
	`has_https` integer,
	`title` text,
	`meta_description` text,
	`mobile_performance_score` integer,
	`seo_score` integer,
	`accessibility_score` integer,
	`best_practices_score` integer,
	`lcp` text,
	`cls` text,
	`tbt` text,
	`has_phone` integer,
	`has_contact_link` integer,
	`has_services_content` integer,
	`has_booking_link` integer,
	`detected_builder` text,
	`contacts_json` text,
	`issues_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
