CREATE TABLE `TrackCurrent` (
	`id` varchar(191) NOT NULL,
	`trackId` varchar(255),
	`trackName` varchar(500) NOT NULL,
	`artistName` varchar(255) NOT NULL,
	`country` varchar(10) NOT NULL DEFAULT 'global',
	`rank` int NOT NULL,
	`previousRank` int,
	`rankDelta` int,
	`dailyStreams` bigint NOT NULL,
	`totalStreams` bigint,
	`imageUrl` varchar(500),
	`previewUrl` varchar(500),
	`spotifyUrl` varchar(500),
	`lastUpdated` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `TrackCurrent_id` PRIMARY KEY(`id`),
	CONSTRAINT `TrackCurrent_trackName_artistName_country_key` UNIQUE(`trackName`,`artistName`,`country`)
);
--> statement-breakpoint
CREATE TABLE `TrackSnapshot` (
	`id` varchar(191) NOT NULL,
	`trackName` varchar(500) NOT NULL,
	`artistName` varchar(255) NOT NULL,
	`country` varchar(10) NOT NULL DEFAULT 'global',
	`rank` int NOT NULL,
	`dailyStreams` bigint NOT NULL,
	`totalStreams` bigint,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `TrackSnapshot_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `TrackCurrent_rank_idx` ON `TrackCurrent` (`rank`);--> statement-breakpoint
CREATE INDEX `TrackCurrent_trackName_artistName_idx` ON `TrackCurrent` (`trackName`,`artistName`);--> statement-breakpoint
CREATE INDEX `TrackCurrent_country_idx` ON `TrackCurrent` (`country`);--> statement-breakpoint
CREATE INDEX `TrackSnapshot_createdAt_idx` ON `TrackSnapshot` (`createdAt`);--> statement-breakpoint
CREATE INDEX `TrackSnapshot_trackName_artistName_idx` ON `TrackSnapshot` (`trackName`,`artistName`);--> statement-breakpoint
CREATE INDEX `TrackSnapshot_country_idx` ON `TrackSnapshot` (`country`);