-- CreateTable
CREATE TABLE `theme_sounds` (
    `theme_id` VARCHAR(50) NOT NULL,
    `slot` INTEGER NOT NULL,
    `filename` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`theme_id`, `slot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `themes` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `bg_top` VARCHAR(7) NOT NULL,
    `bg_bottom` VARCHAR(7) NOT NULL,
    `bg_image` VARCHAR(255) NULL,
    `body_class` VARCHAR(100) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `theme_sounds` ADD CONSTRAINT `theme_sounds_ibfk_1` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

