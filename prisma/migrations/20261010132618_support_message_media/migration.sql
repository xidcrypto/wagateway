-- AlterTable
ALTER TABLE `support_messages` ADD COLUMN `media_mime` VARCHAR(64) NULL,
    ADD COLUMN `media_path` VARCHAR(512) NULL;
