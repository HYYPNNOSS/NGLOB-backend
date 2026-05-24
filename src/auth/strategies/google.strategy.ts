import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'mock_google_id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'mock_google_secret',
      callbackURL: `${configService.get<string>('API_URL') || 'http://localhost:3001/api'}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id } = profile;
    const user = {
      provider: 'google',
      providerId: id,
      email: emails[0].value,
      name: name.givenName + ' ' + (name.familyName || ''),
      accessToken,
    };
    done(null, user);
  }
}
