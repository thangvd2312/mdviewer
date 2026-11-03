import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { OptionalAuthGuard } from "../auth/optional-auth.guard";
import { clientInfo } from "./client-info";
import { Actor, CommentsService } from "./comments.service";
import {
  BlocksQuery,
  CommentsQuery,
  CreateCommentDto,
  ExploreQuery,
  HideCommentDto,
  RepliesQuery,
  SlugParam,
  UpdateCommentDto,
} from "./public.dto";
import { PublicDocsService } from "./public-docs.service";
import { SameSiteWriteGuard } from "./same-site-write.guard";

/**
 * Public pages: anyone can read published documents and comment (signed in or as a guest).
 * A token is optional; when present the reader is recognised (their own comments, moderation).
 */
@Controller("public")
@UseGuards(OptionalAuthGuard, SameSiteWriteGuard)
export class PublicController {
  constructor(
    private readonly docs: PublicDocsService,
    private readonly comments: CommentsService,
  ) {}

  /** Explore: published documents, newest or most read first. */
  @Get("docs")
  list(@Query() query: ExploreQuery) {
    return this.docs.list(query);
  }

  @Get("docs/:slug")
  read(
    @Param() { slug }: SlugParam,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    const client = clientInfo(req);
    return this.docs.read(slug, {
      userId: user?.id,
      ip: client.ip,
      userAgent: client.userAgent,
    });
  }

  /** Top-level threads, newest first, 20 at a time (pass `before=<nextCursor>` for more). */
  @Get("docs/:slug/comments")
  listComments(
    @Param() { slug }: SlugParam,
    @Query() q: CommentsQuery,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.list(slug, user?.id, q.before);
  }

  /** More replies of a top-level comment (pass `after=<moreReplies>`). */
  @Get("comments/:id/replies")
  listReplies(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: RepliesQuery,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.replies(id, user?.id, q.after);
  }

  /** Guests get back `guestToken`: their browser keeps it to edit or delete the comment later. */
  @Post("docs/:slug/comments")
  createComment(
    @Param() { slug }: SlugParam,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    return this.comments.create(slug, dto, actor(req, user));
  }

  /** Author only; guests send their secret in the X-Guest-Token header. */
  @Patch("comments/:id")
  updateComment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    return this.comments.update(id, dto, actor(req, user));
  }

  /** The comment's author (guests: X-Guest-Token) or the page's author. */
  @Delete("comments/:id")
  @HttpCode(204)
  removeComment(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    return this.comments.remove(id, actor(req, user));
  }

  /** Page author: hide a comment from everyone else, or show it again. */
  @Put("comments/:id/hidden")
  @HttpCode(204)
  hide(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: HideCommentDto,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.setHidden(id, dto.hidden, signedIn(user));
  }

  /** Page author: stop this comment's writer from commenting on any of their pages. */
  @Post("comments/:id/block")
  @HttpCode(204)
  block(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.block(id, signedIn(user));
  }

  @Delete("comments/:id/block")
  @HttpCode(204)
  unblock(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.unblock(id, signedIn(user));
  }

  /** The signed-in author's blocked commenters (names and devices only). */
  @Get("blocks")
  listBlocks(
    @Query() q: BlocksQuery,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.listBlocks(signedIn(user), q.offset, q.limit);
  }

  @Delete("blocks/:id")
  @HttpCode(204)
  removeBlock(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.comments.removeBlock(signedIn(user), id);
  }
}

function actor(req: Request, user: AuthUser | undefined): Actor {
  const token = req.headers["x-guest-token"];
  return {
    userId: user?.id,
    client: clientInfo(req),
    guestToken:
      typeof token === "string" && token.length <= 100 ? token : undefined,
  };
}

function signedIn(user: AuthUser | undefined) {
  if (!user) throw new UnauthorizedException("Sign in first.");
  return user.id;
}
