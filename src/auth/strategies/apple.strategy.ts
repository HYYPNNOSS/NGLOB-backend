import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-apple';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID') || 'mock_apple_id',
      teamID: configService.get<string>('APPLE_TEAM_ID') || 'mock_team_id',
      keyID: configService.get<string>('APPLE_KEY_ID') || 'mock_key_id',
      privateKeyString: configService.get<string>('APPLE_PRIVATE_KEY') || 'mock_private_key',
      callbackURL: `${configService.get<string>('API_URL') || 'http://localhost:3001/api'}/auth/apple/callback`,
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: any,
    done: (err: any, user?: any, info?: any) => void,
  ): Promise<any> {
    // Apple might not provide email/name on subsequent logins
    const user = {
      provider: 'apple',
      providerId: profile?.id || idToken,
      email: profile?.email || `${profile?.id || 'apple_user'}@apple.mock`,
      name: profile?.name ? `${profile.name.firstName} ${profile.name.lastName}` : 'Apple User',
    };
    done(null, user);
  }
}
