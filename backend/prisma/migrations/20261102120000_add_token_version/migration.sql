-- Bumped on password change: tokens signed with an older version are rejected
ALTER TABLE `users` ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0;
