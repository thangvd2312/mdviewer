import { MigrationInterface, QueryRunner } from "typeorm";

export class Review1793712197354 implements MigrationInterface {
    name = 'Review1793712197354'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`review_cards\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`docId\` varchar(36) NOT NULL, \`question\` text NOT NULL, \`answer\` text NOT NULL, \`section\` varchar(300) NULL, \`origin\` varchar(16) NOT NULL, \`basedOn\` text NULL, \`due\` datetime(3) NOT NULL, \`intervalDays\` float NOT NULL DEFAULT '0', \`ease\` float NOT NULL DEFAULT '3', \`reps\` int NOT NULL DEFAULT '0', \`lapses\` int NOT NULL DEFAULT '0', \`lastReviewedAt\` datetime(3) NULL, \`createdAt\` datetime(3) NOT NULL, INDEX \`IDX_d8853f92303fb6b2078117d70f\` (\`docId\`, \`createdAt\`), INDEX \`IDX_9b73e3eb457e255c9559e7694d\` (\`ownerId\`, \`due\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`review_events\` (\`id\` varchar(36) NOT NULL, \`ownerId\` varchar(36) NOT NULL, \`cardId\` varchar(36) NOT NULL, \`rating\` varchar(8) NOT NULL, \`reviewedAt\` datetime(3) NOT NULL, INDEX \`IDX_3117c7d1d4ccca7749d965f6f6\` (\`ownerId\`, \`reviewedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD CONSTRAINT \`FK_306003db2891596720ab8a248e2\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD CONSTRAINT \`FK_292d116c4c8e80f04d7dd8b7bcd\` FOREIGN KEY (\`docId\`) REFERENCES \`documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD CONSTRAINT \`FK_1b492087ba0992b27cf58815db9\` FOREIGN KEY (\`ownerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD CONSTRAINT \`FK_6675569d3f1ef0469309d569608\` FOREIGN KEY (\`cardId\`) REFERENCES \`review_cards\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP FOREIGN KEY \`FK_6675569d3f1ef0469309d569608\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP FOREIGN KEY \`FK_1b492087ba0992b27cf58815db9\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP FOREIGN KEY \`FK_292d116c4c8e80f04d7dd8b7bcd\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP FOREIGN KEY \`FK_306003db2891596720ab8a248e2\``);
        await queryRunner.query(`DROP INDEX \`IDX_3117c7d1d4ccca7749d965f6f6\` ON \`review_events\``);
        await queryRunner.query(`DROP TABLE \`review_events\``);
        await queryRunner.query(`DROP INDEX \`IDX_9b73e3eb457e255c9559e7694d\` ON \`review_cards\``);
        await queryRunner.query(`DROP INDEX \`IDX_d8853f92303fb6b2078117d70f\` ON \`review_cards\``);
        await queryRunner.query(`DROP TABLE \`review_cards\``);
    }

}
