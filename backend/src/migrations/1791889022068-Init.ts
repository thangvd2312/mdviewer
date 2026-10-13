import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1791889022068 implements MigrationInterface {
    name = 'Init1791889022068'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`githubId\` varchar(32) NULL, \`githubLogin\` varchar(100) NULL, \`email\` varchar(191) NULL, \`name\` varchar(100) NOT NULL, \`avatarUrl\` varchar(500) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_42148de213279d66bf94b363bf\` (\`githubId\`), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`projects\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`name\` varchar(120) NOT NULL, \`description\` varchar(500) NULL, \`icon\` varchar(16) NOT NULL DEFAULT '📁', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_a8e7e6c3f9d9528ed35fe5bae3\` (\`ownerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`documents\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`projectId\` varchar(36) NULL, \`title\` varchar(255) NOT NULL, \`content\` longtext NOT NULL, \`excerpt\` varchar(300) NOT NULL DEFAULT '', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(3) NOT NULL, \`lastOpenedAt\` datetime(3) NOT NULL, INDEX \`IDX_fe6ebd6e679c0feee3a7ecc035\` (\`projectId\`), INDEX \`IDX_79597f9497101378066988d82b\` (\`ownerId\`, \`lastOpenedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`projects\` ADD CONSTRAINT \`FK_a8e7e6c3f9d9528ed35fe5bae33\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD CONSTRAINT \`FK_4106f2a9b30c9ff2f717894a970\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD CONSTRAINT \`FK_fe6ebd6e679c0feee3a7ecc0354\` FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`documents\` DROP FOREIGN KEY \`FK_fe6ebd6e679c0feee3a7ecc0354\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP FOREIGN KEY \`FK_4106f2a9b30c9ff2f717894a970\``);
        await queryRunner.query(`ALTER TABLE \`projects\` DROP FOREIGN KEY \`FK_a8e7e6c3f9d9528ed35fe5bae33\``);
        await queryRunner.query(`DROP INDEX \`IDX_79597f9497101378066988d82b\` ON \`documents\``);
        await queryRunner.query(`DROP INDEX \`IDX_fe6ebd6e679c0feee3a7ecc035\` ON \`documents\``);
        await queryRunner.query(`DROP TABLE \`documents\``);
        await queryRunner.query(`DROP INDEX \`IDX_a8e7e6c3f9d9528ed35fe5bae3\` ON \`projects\``);
        await queryRunner.query(`DROP TABLE \`projects\``);
        await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`IDX_42148de213279d66bf94b363bf\` ON \`users\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }

}
