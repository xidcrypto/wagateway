-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `avatar_url` TEXT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `webhook_url` TEXT NULL,
    `webhook_secret` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `owner_id` INTEGER NULL,
    `label` VARCHAR(255) NOT NULL,
    `status` ENUM('connecting', 'qr', 'pairing', 'open', 'closed', 'logged_out', 'stopped') NOT NULL DEFAULT 'connecting',
    `phone` VARCHAR(32) NULL,
    `wa_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` CHAR(36) NOT NULL,
    `direction` ENUM('in', 'out') NOT NULL,
    `wa_id` VARCHAR(191) NULL,
    `remote_jid` VARCHAR(191) NOT NULL,
    `msg_type` VARCHAR(191) NOT NULL,
    `text_body` TEXT NULL,
    `status` ENUM('pending', 'sent', 'delivered', 'read', 'failed') NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_session_id_remote_jid_created_at_idx`(`session_id`, `remote_jid`, `created_at`),
    INDEX `messages_session_id_wa_id_idx`(`session_id`, `wa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blasts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` CHAR(36) NOT NULL,
    `owner_id` INTEGER NULL,
    `label` VARCHAR(191) NOT NULL,
    `text_body` TEXT NOT NULL,
    `media_json` JSON NULL,
    `buttons_json` JSON NULL,
    `total` INTEGER NOT NULL DEFAULT 0,
    `delay_min` INTEGER NOT NULL,
    `delay_max` INTEGER NOT NULL,
    `status` ENUM('queued', 'running', 'paused', 'done', 'cancelled', 'failed') NOT NULL DEFAULT 'queued',
    `error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blast_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `blast_id` INTEGER NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `vars` JSON NULL,
    `status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    `error` TEXT NULL,
    `sent_at` DATETIME(3) NULL,

    INDEX `blast_recipients_blast_id_status_idx`(`blast_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blasts` ADD CONSTRAINT `blasts_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blast_recipients` ADD CONSTRAINT `blast_recipients_blast_id_fkey` FOREIGN KEY (`blast_id`) REFERENCES `blasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
