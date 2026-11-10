import { MigrationInterface, QueryRunner } from "typeorm";

/** Public posts readers saved to read later. */
export class SavedPosts1794307131294 implements MigrationInterface {
    name = 'SavedPosts1794307131294'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`saved_posts\` (\`id\` varchar(36) NOT NULL, \`userId\` varchar(36) NOT NULL, \`docId\` varchar(36) NULL, \`title\` varchar(300) NOT NULL, \`slug\` varchar(100) NOT NULL, \`createdAt\` datetime(3) NOT NULL, \`readAt\` datetime(3) NULL, INDEX \`IDX_b2b1d571903f71883bc942f2ed\` (\`userId\`, \`createdAt\`), UNIQUE INDEX \`IDX_0c38faae80c98e1c8f4b25e819\` (\`userId\`, \`docId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`saved_posts\` ADD CONSTRAINT \`FK_2a6ac38aa1767f692d4f492639b\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`saved_posts\` ADD CONSTRAINT \`FK_8392979e3173fc804604b296da4\` FOREIGN KEY (\`docId\`) REFERENCES \`documents\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`saved_posts\` DROP FOREIGN KEY \`FK_8392979e3173fc804604b296da4\``);
        await queryRunner.query(`ALTER TABLE \`saved_posts\` DROP FOREIGN KEY \`FK_2a6ac38aa1767f692d4f492639b\``);
        await queryRunner.query(`DROP INDEX \`IDX_0c38faae80c98e1c8f4b25e819\` ON \`saved_posts\``);
        await queryRunner.query(`DROP INDEX \`IDX_b2b1d571903f71883bc942f2ed\` ON \`saved_posts\``);
        await queryRunner.query(`DROP TABLE \`saved_posts\``);
    }

}
