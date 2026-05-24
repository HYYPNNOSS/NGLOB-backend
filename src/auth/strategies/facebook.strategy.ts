import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID') || 'mock_fb_id',
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET') || 'mock_fb_secret',
      callbackURL: `${configService.get<string>('API_URL') || 'http://localhost:3001/api'}/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails, id } = profile;
    const user = {
      provider: 'facebook',
      providerId: id,
      email: emails && emails.length ? emails[0].value : `${id}@facebook.mock`,
      name: name ? (name.givenName + ' ' + (name.familyName || '')) : 'Facebook User',
      accessToken,
    };
    done(null, user);
  }
}
