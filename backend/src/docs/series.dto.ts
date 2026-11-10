import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SeriesSharingDto {
  /** true = the project is a series on the blog at /blog/series/<slug>. */
  @IsBoolean()
  public: boolean;

  /** Also publish the project's private documents (only public documents appear in the series). */
  @IsOptional()
  @IsBoolean()
  publishDocs?: boolean;
}

export class ReorderDto {
  /** The project's documents, first to last. Documents left out keep coming after these, by title. */
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  docIds: string[];
}
