import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sub-projects: a project can sit inside another one. */
export class ProjectParents1794400000000 implements MigrationInterface {
  name = 'ProjectParents1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `projects` ADD `parentId` varchar(36) NULL');
    await queryRunner.query(
      'ALTER TABLE `projects` ADD CONSTRAINT `FK_18318a4fe88f052b51921cb4a5d` FOREIGN KEY (`parentId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `projects` DROP FOREIGN KEY `FK_18318a4fe88f052b51921cb4a5d`');
    await queryRunner.query('ALTER TABLE `projects` DROP COLUMN `parentId`');
  }
}
