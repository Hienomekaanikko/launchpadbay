-- CreateTable
CREATE TABLE `friendships` (
    `requester_id` VARCHAR(50) NOT NULL,
    `addressee_id` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `friendships_addressee_id_fkey`(`addressee_id`),
    PRIMARY KEY (`requester_id`, `addressee_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_addressee_id_fkey` FOREIGN KEY (`addressee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
