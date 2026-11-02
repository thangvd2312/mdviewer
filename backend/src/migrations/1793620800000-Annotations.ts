import { MigrationInterface, QueryRunner } from "typeorm";

export class Annotations1793620800000 implements MigrationInterface {
    name = 'Annotations1793620800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`annotations\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`docId\` varchar(36) NOT NULL, \`kind\` varchar(16) NOT NULL DEFAULT 'note', \`quote\` text NOT NULL, \`prefix\` varchar(64) NOT NULL DEFAULT '', \`suffix\` varchar(64) NOT NULL DEFAULT '', \`position\` int NOT NULL DEFAULT '0', \`body\` text NOT NULL, \`createdAt\` datetime(3) NOT NULL, \`updatedAt\` datetime(3) NOT NULL, INDEX \`IDX_ff37a18d9fa73e433cc9e126bc\` (\`docId\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`annotations\` ADD CONSTRAINT \`FK_039c42bd7b1b5bd7bb49e91de31\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`annotations\` ADD CONSTRAINT \`FK_59187dc5521214b46e5935df772\` FOREIGN KEY (\`docId\`) REFERENCES \`documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`annotations\` DROP FOREIGN KEY \`FK_59187dc5521214b46e5935df772\``);
        await queryRunner.query(`ALTER TABLE \`annotations\` DROP FOREIGN KEY \`FK_039c42bd7b1b5bd7bb49e91de31\``);
        await queryRunner.query(`DROP INDEX \`IDX_ff37a18d9fa73e433cc9e126bc\` ON \`annotations\``);
        await queryRunner.query(`DROP TABLE \`annotations\``);
    }

}
