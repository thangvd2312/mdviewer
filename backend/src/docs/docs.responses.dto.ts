import { PickType } from '@nestjs/swagger';
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
] as const) {}
