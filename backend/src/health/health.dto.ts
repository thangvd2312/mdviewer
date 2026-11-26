export class HealthDto {
  /** Always "ok" — the API and its database answered. */
  status: string;
  /** Commit currently running (APP_VERSION baked into the image), `dev` locally. CI waits for it after a deploy. */
  version: string;
}
