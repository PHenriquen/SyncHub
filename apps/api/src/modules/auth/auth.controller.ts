import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@synchub/contracts';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../common/authenticated-user.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(input);
    this.writeSessionCookies(response, session);
    return { accessToken: session.accessToken };
  }

  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(input);
    this.writeSessionCookies(response, session);
    return { accessToken: session.accessToken };
  }

  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('Refresh cookie is missing');

    const session = await this.authService.refresh(refreshToken);
    this.writeSessionCookies(response, session);
    return { accessToken: session.accessToken };
  }

  @HttpCode(204)
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (refreshToken) await this.authService.logout(refreshToken);
    response.clearCookie(ACCESS_COOKIE, { path: ACCESS_COOKIE_PATH });
    response.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    response.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }

  private writeSessionCookies(response: Response, session: SessionTokens) {
    const secure = this.config.get('NODE_ENV') === 'production';
    const accessMaxAge = Number(this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900) * 1000;
    const refreshMaxAge =
      Number(this.config.get('JWT_REFRESH_TTL_SECONDS') ?? 30 * 24 * 60 * 60) * 1000;
    const baseOptions = { httpOnly: true, sameSite: 'lax' as const, secure };

    response.cookie(ACCESS_COOKIE, session.accessToken, {
      ...baseOptions,
      path: ACCESS_COOKIE_PATH,
      maxAge: accessMaxAge,
    });
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...baseOptions,
      path: REFRESH_COOKIE_PATH,
      maxAge: refreshMaxAge,
    });
  }
}
