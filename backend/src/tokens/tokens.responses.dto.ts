import { OmitType } from '@nestjs/swagger';
import { ApiToken } from './api-token.entity';

/** A new token: the only time the secret itself is returned. */
export class CreatedTokenDto extends OmitType(ApiToken, ['tokenHash', 'owner'] as const) {
  /** `vmd_…` — send as `Authorization: Bearer <token>` to /api/mcp. Store it now; it can't be shown again. */
  token: string;
}
