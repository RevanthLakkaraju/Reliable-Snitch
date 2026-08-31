CREATE TABLE `complaint_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`photo_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_key`) REFERENCES `uploads`(`key`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "photo_review_status" CHECK("complaint_photos"."status" IN ('pending','approved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `complaint_photos_photo_key_unique` ON `complaint_photos` (`photo_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_pending_photo` ON `complaint_photos` (`report_id`) WHERE "complaint_photos"."status"='pending';--> statement-breakpoint
CREATE TABLE `complaint_registry` (
	`report_id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`ward` text DEFAULT 'Unverified locality' NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`assignee` text DEFAULT '' NOT NULL,
	`due_at` integer,
	`provider_ticket` text DEFAULT '' NOT NULL,
	`coordination` text DEFAULT 'Not required' NOT NULL,
	`clarification` text DEFAULT '' NOT NULL,
	`escalated` integer DEFAULT 0 NOT NULL,
	`photo_approved` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_registry_owner` ON `complaint_registry` (`owner_id`);--> statement-breakpoint
CREATE TABLE `complaint_supports` (
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`report_id`, `user_id`),
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `portal_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portal_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`official_code_hash` text,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_portal_sessions_expiry` ON `portal_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `portal_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "portal_user_role" CHECK("portal_users"."role" IN ('citizen','official'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_users_username_unique` ON `portal_users` (`username`);