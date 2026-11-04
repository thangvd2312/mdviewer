import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { adminSet, isAdmin } from './admins';
import { GithubProfile } from './github-oauth.service';

export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  githubLogin: string | null;
  avatarUrl: string | null;
  /** Can use the admin pages (e.g. the blog curator). */
  isAdmin: boolean;
}

@Injectable()
export class AuthService {
  private readonly admins: Set<string>;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.admins = adminSet(config);
  }

  private toPublic(u: User): PublicUser {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      githubLogin: u.githubLogin,
      avatarUrl: u.avatarUrl,
      isAdmin: isAdmin(this.admins, u),
    };
  }

  /** Finds or creates the user for a GitHub profile and issues an access token. */
  async loginWithGithub(profile: GithubProfile) {
    let user = await this.users.findOneBy({ githubId: profile.id });

    // First GitHub sign-in for an existing account with the same verified email: link them.
    if (!user && profile.email) {
      const byEmail = await this.users.findOneBy({ email: profile.email });
      if (byEmail && !byEmail.githubId) user = byEmail;
    }

    user ??= this.users.create();
    user.githubId = profile.id;
    user.githubLogin = profile.login;
    user.name = profile.name.slice(0, 100);
    user.avatarUrl = profile.avatarUrl;
    if (profile.email && profile.email !== user.email && !(await this.users.existsBy({ email: profile.email }))) {
      user.email = profile.email;
    }
    user = await this.users.save(user);

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user: this.toPublic(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException();
    return this.toPublic(user);
  }
}
