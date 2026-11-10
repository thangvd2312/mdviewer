import { MigrationInterface, QueryRunner } from 'typeorm';

/** Projects published as series (their own link and publish date) and the order of documents in a project. */
export class Series1794297700000 implements MigrationInterface {
  name = 'Series1794297700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `projects` ADD `slug` varchar(100) NULL');
    await queryRunner.query('ALTER TABLE `projects` ADD UNIQUE INDEX `IDX_96e045ab8b0271e5f5a91eae1e` (`slug`)');
    await queryRunner.query('ALTER TABLE `projects` ADD `publishedAt` datetime(3) NULL');
    await queryRunner.query('ALTER TABLE `documents` ADD `position` int NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `documents` DROP COLUMN `position`');
    await queryRunner.query('ALTER TABLE `projects` DROP COLUMN `publishedAt`');
    await queryRunner.query('ALTER TABLE `projects` DROP INDEX `IDX_96e045ab8b0271e5f5a91eae1e`');
    await queryRunner.query('ALTER TABLE `projects` DROP COLUMN `slug`');
  }
}
