/*
  Warnings:

  - You are about to drop the column `codeHash` on the `password_resets` table. All the data in the column will be lost.
  - Added the required column `code_hash` to the `password_resets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `password_resets` DROP COLUMN `codeHash`,
    ADD COLUMN `code_hash` VARCHAR(191) NOT NULL;
