-- AlterTable
ALTER TABLE `users` MODIFY `email` VARCHAR(255) NULL,
    MODIFY `password_hash` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `github_id` VARCHAR(50) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_github_id_key` ON `users`(`github_id`);
