import { MigrationInterface, QueryRunner } from 'typeorm';
import { publicFields } from '../docs/redact';

/**
 * What the blog shows of a document, with sensitive parts hidden: title and summary (new columns,
 * which the blog also searches) and topics (recomputed). Fills them in for every document.
 */
export class PublicCopies1794297600000 implements MigrationInterface {
  name = 'PublicCopies1794297600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `documents` ADD `publicTitle` varchar(300) NOT NULL DEFAULT ''");
    await queryRunner.query("ALTER TABLE `documents` ADD `publicExcerpt` varchar(400) NOT NULL DEFAULT ''");

    // Batched by id so a large table is never loaded at once; updatedAt is left untouched.
    let after = '';
    for (;;) {
      const rows: { id: string; title: string; content: string }[] = await queryRunner.query(
        'SELECT id, title, content FROM documents WHERE id > ? ORDER BY id LIMIT 200',
        [after],
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        const p = publicFields(row.title, row.content);
        await queryRunner.query('UPDATE documents SET publicTitle = ?, publicExcerpt = ?, topics = ? WHERE id = ?', [
          p.publicTitle,
          p.publicExcerpt,
          JSON.stringify(p.topics),
          row.id,
        ]);
      }
      after = rows[rows.length - 1]!.id;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `documents` DROP COLUMN `publicExcerpt`');
    await queryRunner.query('ALTER TABLE `documents` DROP COLUMN `publicTitle`');
  }
}
