import { MigrationInterface, QueryRunner } from "typeorm";

export class ApiTokens1793703341204 implements MigrationInterface {
    name = 'ApiTokens1793703341204'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`api_tokens\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`name\` varchar(100) NOT NULL, \`tokenHash\` char(64) NOT NULL, \`prefix\` varchar(16) NOT NULL, \`createdAt\` datetime(3) NOT NULL, \`lastUsedAt\` datetime(3) NULL, INDEX \`IDX_4e17e353888719798ee22fe161\` (\`ownerId\`), UNIQUE INDEX \`IDX_cdac8e064e6e9c2e0835d1c1b8\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`api_tokens\` ADD CONSTRAINT \`FK_4e17e353888719798ee22fe1613\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`api_tokens\` DROP FOREIGN KEY \`FK_4e17e353888719798ee22fe1613\``);
        await queryRunner.query(`DROP INDEX \`IDX_cdac8e064e6e9c2e0835d1c1b8\` ON \`api_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_4e17e353888719798ee22fe161\` ON \`api_tokens\``);
        await queryRunner.query(`DROP TABLE \`api_tokens\``);
    }

}
