import { MigrationInterface, QueryRunner } from "typeorm";

export class PublicDocsAndComments1793677416449 implements MigrationInterface {
    name = 'PublicDocsAndComments1793677416449'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`doc_comments\` (\`id\` varchar(36) NOT NULL, \`docId\` varchar(36) NOT NULL, \`parentId\` varchar(36) NULL, \`authorId\` varchar(36) NULL, \`guestName\` varchar(50) NULL, \`guestTokenHash\` char(64) NULL, \`body\` text NOT NULL, \`ip\` varchar(45) NULL, \`userAgent\` varchar(400) NOT NULL DEFAULT '', \`device\` varchar(80) NOT NULL DEFAULT '', \`createdAt\` datetime(3) NOT NULL, \`editedAt\` datetime(3) NULL, \`hiddenAt\` datetime(3) NULL, \`deletedAt\` datetime(3) NULL, INDEX \`IDX_5b718c3ff24d0c7e94924b3f3d\` (\`authorId\`, \`createdAt\`), INDEX \`IDX_a719329cd027425f65fb4be271\` (\`ip\`, \`createdAt\`), INDEX \`IDX_d41403966d802d46379352ed7e\` (\`parentId\`, \`createdAt\`), INDEX \`IDX_86636efb828751be21ec040e0b\` (\`docId\`, \`parentId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`comment_blocks\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`userId\` varchar(36) NULL, \`ip\` varchar(45) NULL, \`label\` varchar(100) NOT NULL DEFAULT '', \`device\` varchar(80) NOT NULL DEFAULT '', \`createdAt\` datetime(3) NOT NULL, UNIQUE INDEX \`IDX_a0d268eecdab03b30981cb48f0\` (\`ownerId\`, \`ip\`), UNIQUE INDEX \`IDX_dbd6cfb50cb15f3ec5f1582321\` (\`ownerId\`, \`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD \`slug\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD UNIQUE INDEX \`IDX_06f1e6b2d31b55696c2899a64d\` (\`slug\`)`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD \`publishedAt\` datetime(3) NULL`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD \`allowComments\` tinyint NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD \`viewCount\` int UNSIGNED NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX \`IDX_2bfee43add5344020581b6269f\` ON \`documents\` (\`publishedAt\`)`);
        await queryRunner.query(`ALTER TABLE \`doc_comments\` ADD CONSTRAINT \`FK_db4442f7e9c1b7f6e1a703eeb8f\` FOREIGN KEY (\`docId\`) REFERENCES \`documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`doc_comments\` ADD CONSTRAINT \`FK_c4b36b534b6ea8854d170baeb72\` FOREIGN KEY (\`parentId\`) REFERENCES \`doc_comments\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`doc_comments\` ADD CONSTRAINT \`FK_1525c604203b5452baf32593c6d\` FOREIGN KEY (\`authorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`comment_blocks\` ADD CONSTRAINT \`FK_3dc869745a10a3eece73576af48\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`comment_blocks\` ADD CONSTRAINT \`FK_e88d90b870334783e31091eecd2\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`comment_blocks\` DROP FOREIGN KEY \`FK_e88d90b870334783e31091eecd2\``);
        await queryRunner.query(`ALTER TABLE \`comment_blocks\` DROP FOREIGN KEY \`FK_3dc869745a10a3eece73576af48\``);
        await queryRunner.query(`ALTER TABLE \`doc_comments\` DROP FOREIGN KEY \`FK_1525c604203b5452baf32593c6d\``);
        await queryRunner.query(`ALTER TABLE \`doc_comments\` DROP FOREIGN KEY \`FK_c4b36b534b6ea8854d170baeb72\``);
        await queryRunner.query(`ALTER TABLE \`doc_comments\` DROP FOREIGN KEY \`FK_db4442f7e9c1b7f6e1a703eeb8f\``);
        await queryRunner.query(`DROP INDEX \`IDX_2bfee43add5344020581b6269f\` ON \`documents\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP COLUMN \`viewCount\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP COLUMN \`allowComments\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP COLUMN \`publishedAt\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP INDEX \`IDX_06f1e6b2d31b55696c2899a64d\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP COLUMN \`slug\``);
        await queryRunner.query(`DROP INDEX \`IDX_dbd6cfb50cb15f3ec5f1582321\` ON \`comment_blocks\``);
        await queryRunner.query(`DROP INDEX \`IDX_a0d268eecdab03b30981cb48f0\` ON \`comment_blocks\``);
        await queryRunner.query(`DROP TABLE \`comment_blocks\``);
        await queryRunner.query(`DROP INDEX \`IDX_86636efb828751be21ec040e0b\` ON \`doc_comments\``);
        await queryRunner.query(`DROP INDEX \`IDX_d41403966d802d46379352ed7e\` ON \`doc_comments\``);
        await queryRunner.query(`DROP INDEX \`IDX_a719329cd027425f65fb4be271\` ON \`doc_comments\``);
        await queryRunner.query(`DROP INDEX \`IDX_5b718c3ff24d0c7e94924b3f3d\` ON \`doc_comments\``);
        await queryRunner.query(`DROP TABLE \`doc_comments\``);
    }

}
