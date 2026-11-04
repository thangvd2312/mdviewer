declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown';
  /** Tables, strikethrough and task lists for Turndown. */
  export const gfm: TurndownService.Plugin;
}
