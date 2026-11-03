import { MigrationInterface, QueryRunner } from "typeorm";
import { countWords, makeExcerpt, topicsOf } from "../docs/markdown.util";

export class DocTopicsAndWordCount1793680832615 implements MigrationInterface {
    name = 'DocTopicsAndWordCount1793680832615'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`documents\` ADD \`wordCount\` int UNSIGNED NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`documents\` ADD \`topics\` json NULL`);

        // Backfill: summary (now from the opening prose), topics and word count for every document.
        // Batched by id so a large table is never loaded at once; updatedAt is left untouched.
        let after = "";
        for (;;) {
            const rows: { id: string; content: string }[] = await queryRunner.query(
                "SELECT id, content FROM documents WHERE id > ? ORDER BY id LIMIT 200",
                [after],
            );
            if (rows.length === 0) break;
            for (const row of rows) {
                await queryRunner.query("UPDATE documents SET excerpt = ?, topics = ?, wordCount = ? WHERE id = ?", [
                    makeExcerpt(row.content),
                    JSON.stringify(topicsOf(row.content)),
                    countWords(row.content),
                    row.id,
                ]);
            }
            after = rows[rows.length - 1]!.id;
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`documents\` DROP COLUMN \`topics\``);
        await queryRunner.query(`ALTER TABLE \`documents\` DROP COLUMN \`wordCount\``);
    }

}
