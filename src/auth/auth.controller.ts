import {
  Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req, Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new customer account (awards 230 bonus points)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and get JWT tokens' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and get new access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // ── OAuth Routes ──────────────────────────────────────────
  
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // triggers AuthGuard
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    const tokens = await this.authService.validateOAuthLogin(req.user);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth(@Req() req) {
    // triggers AuthGuard
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Req() req, @Res() res) {
    const tokens = await this.authService.validateOAuthLogin(req.user);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  }

  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth(@Req() req) {
    // triggers AuthGuard
  }

  @Post('apple/callback') // Apple often posts back to the callback URL
  @UseGuards(AuthGuard('apple'))
  async appleAuthRedirect(@Req() req, @Res() res) {
    const tokens = await this.authService.validateOAuthLogin(req.user);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  }
}
