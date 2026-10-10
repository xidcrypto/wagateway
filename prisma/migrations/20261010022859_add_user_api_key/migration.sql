-- Tambah kolom api_key per user (format pn- + 32 hex).
ALTER TABLE `users` ADD COLUMN `api_key` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `users_api_key_key` ON `users`(`api_key`);
