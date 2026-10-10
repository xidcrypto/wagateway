-- AlterTable
ALTER TABLE `support_tickets` ADD COLUMN `admin_last_read_at` DATETIME(3) NULL,
    ADD COLUMN `user_last_read_at` DATETIME(3) NULL;
