/** The signed-in user. */
export class UserDto {
  id: string;
  name: string;
  email: string | null;
  githubLogin: string | null;
  avatarUrl: string | null;
}
