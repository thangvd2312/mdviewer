import { MigrationInterface, QueryRunner } from "typeorm";
import { fromFsrs, GRADES, newMemory, scheduler, toFsrs } from "../review/fsrs";
import type { Rating } from "../review/review.entity";

export class ReviewFsrs1793717487801 implements MigrationInterface {
    name = 'ReviewFsrs1793717487801'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`addedBy\` varchar(8) NOT NULL DEFAULT 'user'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`intervalDays\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`ease\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`state\` tinyint UNSIGNED NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`stability\` double NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`difficulty\` double NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`elapsedDays\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`scheduledDays\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`learningSteps\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD \`state\` tinyint UNSIGNED NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD \`elapsedDays\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD \`stability\` double NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD \`difficulty\` double NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`review_events\` ADD \`scheduledDays\` int NOT NULL DEFAULT '0'`);

        // Switch from the earlier SM-2 style schedule to FSRS: replay each card's review history.
        // Cards never reviewed are simply new (the column defaults); their due date stays as it is.
        const cards: { id: string; createdAt: Date }[] = await queryRunner.query(
            "SELECT id, createdAt FROM review_cards WHERE id IN (SELECT DISTINCT cardId FROM review_events)",
        );
        for (const card of cards) {
            const events: { id: string; rating: Rating; reviewedAt: Date }[] = await queryRunner.query(
                "SELECT id, rating, reviewedAt FROM review_events WHERE cardId = ? ORDER BY reviewedAt",
                [card.id],
            );
            let memory = newMemory(new Date(card.createdAt));
            for (const e of events) {
                const { card: next, log } = scheduler.next(toFsrs(card.id, memory), new Date(e.reviewedAt), GRADES[e.rating]);
                memory = fromFsrs(next);
                await queryRunner.query(
                    "UPDATE review_events SET state = ?, elapsedDays = ?, stability = ?, difficulty = ?, scheduledDays = ? WHERE id = ?",
                    [log.state, log.elapsed_days, memory.stability, memory.difficulty, memory.scheduledDays, e.id],
                );
            }
            await queryRunner.query(
                "UPDATE review_cards SET due = ?, state = ?, stability = ?, difficulty = ?, elapsedDays = ?, scheduledDays = ?, learningSteps = ?, reps = ?, lapses = ?, lastReviewedAt = ? WHERE id = ?",
                [memory.due, memory.state, memory.stability, memory.difficulty, memory.elapsedDays, memory.scheduledDays, memory.learningSteps, memory.reps, memory.lapses, memory.lastReviewedAt, card.id],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`addedBy\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`scheduledDays\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`difficulty\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`stability\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`elapsedDays\``);
        await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`state\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`learningSteps\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`scheduledDays\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`elapsedDays\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`difficulty\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`stability\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` DROP COLUMN \`state\``);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`ease\` float NOT NULL DEFAULT '3'`);
        await queryRunner.query(`ALTER TABLE \`review_cards\` ADD \`intervalDays\` float NOT NULL DEFAULT '0'`);
    }

}
