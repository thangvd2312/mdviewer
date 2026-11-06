import { ApiProperty } from '@nestjs/swagger';
import { type CardOrigin, ORIGINS } from './review.entity';

/** For each rating, ms from now until the card would be due again (for the buttons' labels). */
export class NextIntervalsDto {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

/** A review question about one of the user's documents. */
export class ReviewCardDto {
  id: string;
  docId: string;
  docTitle: string;
  question: string;
  answer: string;
  /** Section of the document it is about. */
  section: string | null;
  /** asked = from a question the user asked the assistant; note = from a sticky note; key = a key point. */
  @ApiProperty({ enum: ORIGINS })
  origin: CardOrigin;
  /** The question or note it was made from. */
  basedOn: string | null;
  isNew: boolean;
  /** Added automatically after the user mastered the earlier questions. */
  levelUp: boolean;
  /** When it is due (ISO). */
  due: string;
  /** FSRS: chance the user still remembers it now (0–1); null for new cards. */
  recall: number | null;
  next: NextIntervalsDto;
}

export class LevelledUpDocDto {
  docId: string;
  docTitle: string;
}

/** The card with its new schedule. */
export class AnsweredCardDto extends ReviewCardDto {
  /** This answer completed the document: new, harder questions are being written. */
  levelledUp: LevelledUpDocDto | null;
}

export class CheckResultDto {
  @ApiProperty({ enum: ['correct', 'partial', 'wrong'] })
  verdict: 'correct' | 'partial' | 'wrong';
  /** A sentence or two on what was right or missing. */
  feedback: string;
}

export class LevelUpDto {
  docId: string;
  title: string;
  /** New questions not tried yet. */
  count: number;
}

/** A document worth making questions from, with its review progress. */
export class ReviewDocDto {
  id: string;
  title: string;
  project: string | null;
  /** Questions the user asked the assistant about it. */
  asked: number;
  notes: number;
  cards: number;
  due: number;
  /** Questions already mastered (FSRS: stable for 5+ days). */
  mastered: number;
}

export class ReviewSummaryDto {
  /** Cards due now. */
  due: number;
  total: number;
  /** Cards never reviewed. */
  new: number;
  reviewedToday: number;
  /** Days in a row with at least one review. */
  streak: number;
  /** Documents that got new, harder questions (not tried yet). */
  levelledUp: LevelUpDto[];
  docs: ReviewDocDto[];
}
