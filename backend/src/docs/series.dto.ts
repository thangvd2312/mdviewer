import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SeriesSharingDto {
  /** true = the project is a series on the blog at /blog/series/<slug>. */
  @IsBoolean()
  public: boolean;

  /**
   * The project's documents that should be public (in the series and on the blog); its other
   * documents become private. Leave out to keep each document as it is.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  publicDocIds?: string[];
}

export class ReorderDto {
  /** The project's documents, first to last. Documents left out keep coming after these, by title. */
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  docIds: string[];
}
