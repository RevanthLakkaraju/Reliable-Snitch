CREATE TABLE `report_events` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`kind` text NOT NULL,
	`note` text NOT NULL,
	`actor` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_report_date` ON `report_events` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`department` text NOT NULL,
	`location_text` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`location_source` text NOT NULL,
	`photo_key` text,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`context` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_request_id_unique` ON `reports` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_updated` ON `reports` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
