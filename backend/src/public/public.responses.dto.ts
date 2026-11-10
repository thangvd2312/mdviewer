import { ApiProperty } from '@nestjs/swagger';

export class PublicAuthorDto {
  name: string;
  login: string | null;
  avatarUrl: string | null;
}

/** A published document as listed on the blog. */
export class PublicDocSummaryDto {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  viewCount: number;
  commentCount: number;
  /** Main section headings. */
  topics: string[];
  readMinutes: number;
  author: PublicAuthorDto;
}

export class ExplorePageDto {
  items: PublicDocSummaryDto[];
  hasMore: boolean;
}

/** A post of a series, in the series' list. */
export class SeriesPartDto {
  slug: string;
  title: string;
}

/** The series a post belongs to, to move between its parts. */
export class SeriesNavDto {
  slug: string;
  name: string;
  icon: string;
  /** 0-based position of this post among `parts`. */
  index: number;
  parts: SeriesPartDto[];
}

/** A series (a published project) as listed on the blog. */
export class PublicSeriesSummaryDto {
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  publishedAt: string;
  /** When its latest part was published. */
  lastPublishedAt: string;
  partCount: number;
  readMinutes: number;
  viewCount: number;
  author: PublicAuthorDto;
}

/** A series page: the project and its published documents, in order. */
export class PublicSeriesDto {
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  publishedAt: string;
  readMinutes: number;
  viewCount: number;
  author: PublicAuthorDto;
  parts: PublicDocSummaryDto[];
}

/** A published document on its reading page. */
export class PublicDocDto extends PublicDocSummaryDto {
  id: string;
  /** Markdown. */
  content: string;
  allowComments: boolean;
  /** The viewer wrote it. */
  isOwner: boolean;
  /** Its series, when its project is published as one. */
  series: SeriesNavDto | null;
}

/** An author's public profile. */
export class AuthorProfileDto extends PublicAuthorDto {
  joinedAt: string;
  postCount: number;
  viewCount: number;
  lastPublishedAt: string | null;
}

export class TopicDto {
  name: string;
  /** Published documents with this topic. */
  count: number;
}

/** Who wrote a comment: a user (with name/login/avatarUrl/isDocAuthor), a guest (name), or a deleted account. */
export class CommentAuthorDto {
  @ApiProperty({ enum: ['user', 'guest', 'gone'] })
  kind: 'user' | 'guest' | 'gone';
  name?: string;
  login?: string | null;
  avatarUrl?: string | null;
  /** The page's author. */
  isDocAuthor?: boolean;
}

export class CommentDto {
  id: string;
  /** Top-level comment it replies to. */
  parentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  /** Deleted but kept because it has replies. */
  deleted: boolean;
  author: CommentAuthorDto;
  /** Written by the signed-in viewer. */
  mine: boolean;
  /** Page author only: hidden from everyone else. */
  hidden?: boolean;
  /** Page author only: its writer is blocked. */
  blocked?: boolean;
  /** Page author only: the writer's device, e.g. "iPhone · Safari". */
  device?: string;
}

/** A top-level comment with its first replies. */
export class ThreadDto {
  comment: CommentDto;
  replies: CommentDto[];
  /** Cursor for more replies (`after=`); null = all shown. */
  moreReplies: string | null;
}

/** One page of a document's comments, newest threads first. */
export class CommentPageDto {
  threads: ThreadDto[];
  /** Cursor for older threads (`before=`); null = no more. */
  nextCursor: string | null;
  /** Comments everyone can see. */
  count: number;
  allowComments: boolean;
  /** The viewer wrote the page: may hide, delete and block. */
  canModerate: boolean;
}

export class RepliesPageDto {
  replies: CommentDto[];
  /** Cursor for more (`after=`); null = no more. */
  moreReplies: string | null;
}

export class CreatedCommentDto {
  comment: CommentDto;
  /** Guests only: keep it to edit or delete the comment (X-Guest-Token), for 24 hours. */
  guestToken?: string;
}

/** A commenter the page author blocked. */
export class CommentBlockDto {
  id: string;
  @ApiProperty({ enum: ['user', 'guest'] })
  kind: 'user' | 'guest';
  name: string;
  login: string | null;
  device: string | null;
  createdAt: string;
}

export class BlocksPageDto {
  items: CommentBlockDto[];
  hasMore: boolean;
}
