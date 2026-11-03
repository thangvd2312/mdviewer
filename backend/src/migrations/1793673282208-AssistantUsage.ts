import { MigrationInterface, QueryRunner } from "typeorm";

export class AssistantUsage1793673282208 implements MigrationInterface {
    name = 'AssistantUsage1793673282208'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`assistant_usage\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`kind\` varchar(16) NOT NULL, \`tier\` varchar(16) NOT NULL, \`model\` varchar(100) NOT NULL, \`promptTokens\` int NOT NULL DEFAULT '0', \`completionTokens\` int NOT NULL DEFAULT '0', \`day\` char(10) NOT NULL, \`createdAt\` datetime(3) NOT NULL, INDEX \`IDX_ad06e32da2be890b9337328dfd\` (\`day\`), INDEX \`IDX_6811c52c56ca62f8b6923be7ab\` (\`ownerId\`, \`day\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` ADD \`tier\` varchar(16) NULL`);
        await queryRunner.query(`ALTER TABLE \`assistant_usage\` ADD CONSTRAINT \`FK_486f8dc2b17d6fea5d50a4ea332\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`assistant_usage\` DROP FOREIGN KEY \`FK_486f8dc2b17d6fea5d50a4ea332\``);
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` DROP COLUMN \`tier\``);
        await queryRunner.query(`DROP INDEX \`IDX_6811c52c56ca62f8b6923be7ab\` ON \`assistant_usage\``);
        await queryRunner.query(`DROP INDEX \`IDX_ad06e32da2be890b9337328dfd\` ON \`assistant_usage\``);
        await queryRunner.query(`DROP TABLE \`assistant_usage\``);
    }

}
