-- Simpan API key sebagai hash sha256 (ganti plaintext).
-- 1) Tambah kolom hash + hint.
ALTER TABLE `users` ADD COLUMN `api_key_hash` VARCHAR(64) NULL;
ALTER TABLE `users` ADD COLUMN `api_key_hint` VARCHAR(8) NULL;
CREATE UNIQUE INDEX `users_api_key_hash_key` ON `users`(`api_key_hash`);
-- 2) Backfill dari plaintext yang ada (hash + 4 char terakhir).
UPDATE `users` SET `api_key_hash` = SHA2(`api_key`, 256), `api_key_hint` = RIGHT(`api_key`, 4) WHERE `api_key` IS NOT NULL;
-- 3) Hapus kolom plaintext + indeks lamanya.
DROP INDEX `users_api_key_key` ON `users`;
ALTER TABLE `users` DROP COLUMN `api_key`;
