import { MigrationInterface, QueryRunner } from 'typeorm';

export class Curator1793802872791 implements MigrationInterface {
  name = 'Curator1793802872791';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`curated_articles\` (\`id\` varchar(36) NOT NULL, \`sourceId\` varchar(64) NOT NULL, \`url\` varchar(1000) NOT NULL, \`title\` varchar(300) NOT NULL, \`sourceName\` varchar(120) NULL, \`topic\` varchar(60) NOT NULL, \`tags\` json NULL, \`upvotes\` int NOT NULL DEFAULT '0', \`comments\` int NOT NULL DEFAULT '0', \`readTime\` int NOT NULL DEFAULT '0', \`sourcePublishedAt\` datetime(3) NULL, \`status\` varchar(16) NOT NULL, \`reason\` text NULL, \`score\` double NULL, \`assessment\` json NULL, \`editorScore\` double NULL, \`editorNotes\` text NULL, \`sources\` json NULL, \`docId\` varchar(36) NULL, \`model\` varchar(100) NULL, \`tokens\` int NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(3) NOT NULL, UNIQUE INDEX \`IDX_5f08ad5462a53225cb7f8fa761\` (\`sourceId\`), INDEX \`IDX_591c5e84a4396100ca65093223\` (\`status\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`curator_runs\` (\`id\` varchar(36) NOT NULL, \`day\` char(10) NOT NULL, \`trigger\` varchar(8) NOT NULL, \`status\` varchar(16) NOT NULL, \`candidates\` int NOT NULL DEFAULT '0', \`scored\` int NOT NULL DEFAULT '0', \`published\` int NOT NULL DEFAULT '0', \`drafts\` int NOT NULL DEFAULT '0', \`log\` mediumtext NULL, \`startedAt\` datetime(3) NOT NULL, \`finishedAt\` datetime(3) NULL, INDEX \`IDX_4e607c7a0731514b5061c7a4cd\` (\`day\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(`ALTER TABLE \`users\` ADD \`isSystem\` tinyint NOT NULL DEFAULT 0`);
    await queryRunner.query(
      `ALTER TABLE \`curated_articles\` ADD CONSTRAINT \`FK_4fc7ba4ed7b1bdd3058fc2ff02e\` FOREIGN KEY (\`docId\`) REFERENCES \`documents\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`curated_articles\` DROP FOREIGN KEY \`FK_4fc7ba4ed7b1bdd3058fc2ff02e\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`isSystem\``);
    await queryRunner.query(`DROP INDEX \`IDX_4e607c7a0731514b5061c7a4cd\` ON \`curator_runs\``);
    await queryRunner.query(`DROP TABLE \`curator_runs\``);
    await queryRunner.query(`DROP INDEX \`IDX_591c5e84a4396100ca65093223\` ON \`curated_articles\``);
    await queryRunner.query(`DROP INDEX \`IDX_5f08ad5462a53225cb7f8fa761\` ON \`curated_articles\``);
    await queryRunner.query(`DROP TABLE \`curated_articles\``);
  }
}
