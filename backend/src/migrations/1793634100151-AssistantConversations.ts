import { MigrationInterface, QueryRunner } from "typeorm";

export class AssistantConversations1793634100151 implements MigrationInterface {
    name = 'AssistantConversations1793634100151'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`assistant_conversations\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`page\` varchar(16) NOT NULL, \`docId\` varchar(36) NULL, \`projectId\` varchar(36) NULL, \`title\` varchar(200) NOT NULL, \`createdAt\` datetime(3) NOT NULL, \`updatedAt\` datetime(3) NOT NULL, INDEX \`IDX_e41a53c7a2aba7662576126c8b\` (\`ownerId\`, \`updatedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`assistant_messages\` (\`id\` varchar(36) NOT NULL, \`conversationId\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`role\` varchar(16) NOT NULL, \`content\` mediumtext NOT NULL, \`quote\` text NULL, \`section\` varchar(300) NULL, \`status\` varchar(16) NULL, \`model\` varchar(100) NULL, \`createdAt\` datetime(3) NOT NULL, INDEX \`IDX_f8d828ff91a8c27e441d0616b9\` (\`ownerId\`, \`createdAt\`), INDEX \`IDX_5efd561429af6400e2e691e180\` (\`conversationId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`assistant_conversations\` ADD CONSTRAINT \`FK_89652bebac8d9e0876290d4cf98\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`assistant_conversations\` ADD CONSTRAINT \`FK_2a5797d72ff4c709e63459b4231\` FOREIGN KEY (\`docId\`) REFERENCES \`documents\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`assistant_conversations\` ADD CONSTRAINT \`FK_2a6240871874b8a652807aa149e\` FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` ADD CONSTRAINT \`FK_8e9c052ae338e02911581179386\` FOREIGN KEY (\`conversationId\`) REFERENCES \`assistant_conversations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` ADD CONSTRAINT \`FK_7a262910dd5d2408830662351da\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` DROP FOREIGN KEY \`FK_7a262910dd5d2408830662351da\``);
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` DROP FOREIGN KEY \`FK_8e9c052ae338e02911581179386\``);
        await queryRunner.query(`ALTER TABLE \`assistant_conversations\` DROP FOREIGN KEY \`FK_2a6240871874b8a652807aa149e\``);
        await queryRunner.query(`ALTER TABLE \`assistant_conversations\` DROP FOREIGN KEY \`FK_2a5797d72ff4c709e63459b4231\``);
        await queryRunner.query(`ALTER TABLE \`assistant_conversations\` DROP FOREIGN KEY \`FK_89652bebac8d9e0876290d4cf98\``);
        await queryRunner.query(`DROP INDEX \`IDX_5efd561429af6400e2e691e180\` ON \`assistant_messages\``);
        await queryRunner.query(`DROP INDEX \`IDX_f8d828ff91a8c27e441d0616b9\` ON \`assistant_messages\``);
        await queryRunner.query(`DROP TABLE \`assistant_messages\``);
        await queryRunner.query(`DROP INDEX \`IDX_e41a53c7a2aba7662576126c8b\` ON \`assistant_conversations\``);
        await queryRunner.query(`DROP TABLE \`assistant_conversations\``);
    }

}
