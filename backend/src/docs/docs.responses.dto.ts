import { ApiProperty, PickType } from '@nestjs/swagger';
import { Doc } from './doc.entity';

/** A document in a list: everything but its content. */
export class DocSummaryDto extends PickType(Doc, [
  'id',
  'projectId',
  'title',
  'excerpt',
  'createdAt',
  'updatedAt',
  'lastOpenedAt',
  'slug',
  'publishedAt',
  'allowComments',
  'position',
] as const) {}

const SENSITIVE_KINDS = [
  'secret',
  'token',
  'private-key',
  'email',
  'phone',
  'ip',
  'card',
  'id-number',
  'marked',
  'hidden-block',
] as const;

/** Something readers won't see when the doc is public. */
export class SensitiveFindingDto {
  /** secret/token/private-key: credentials; email, phone, ip, card, id-number: personal data; marked: `||…||`; hidden-block: `<!-- private -->…<!-- /private -->`. */
  @ApiProperty({ enum: SENSITIVE_KINDS })
  kind: (typeof SENSITIVE_KINDS)[number];

  /** What gets hidden (shortened). */
  value: string;
}

/** What publishing hides from readers. */
export class SensitiveReportDto {
  /** The title readers see. */
  title: string;

  findings: SensitiveFindingDto[];
}
