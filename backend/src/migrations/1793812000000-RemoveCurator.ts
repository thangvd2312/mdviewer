import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the blog curator (reverted): the posts it published and its system account (their comments,
 * notes and review questions go with them through the cascades), its two tables and users.isSystem.
 * Safe on databases that never had it.
 */
export class RemoveCurator1793812000000 implements MigrationInterface {
  name = 'RemoveCurator1793812000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `curated_articles`');
    await queryRunner.query('DROP TABLE IF EXISTS `curator_runs`');
    if (await queryRunner.hasColumn('users', 'isSystem')) {
      await queryRunner.query('DELETE FROM `users` WHERE `isSystem` = 1');
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `isSystem`');
    }
    await queryRunner.query("DELETE FROM `migrations` WHERE `name` = 'Curator1793802872791'");
  }

  public async down(): Promise<void> {
    // The curator's data can't be brought back.
  }
}
