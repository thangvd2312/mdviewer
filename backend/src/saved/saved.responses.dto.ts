import { PublicAuthorDto } from '../public/public.responses.dto';

/** A saved post. When the author unpublished or deleted it, only `slug`, `title` and the dates are left. */
export class SavedItemDto {
  slug: string;
  title: string;
  /** Still public: false once the author unpublished or deleted it. */
  available: boolean;
  excerpt: string | null;
  readMinutes: number | null;
  author: PublicAuthorDto | null;
  savedAt: string;
  readAt: string | null;
}

export class SavedCountsDto {
  unread: number;
  read: number;
}

export class SavedPageDto {
  items: SavedItemDto[];
  hasMore: boolean;
  counts: SavedCountsDto;
}

export class SavedSeriesDto {
  /** Parts of the series now in the reader's list. */
  saved: number;
}
