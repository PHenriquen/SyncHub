import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, WorkspaceRole } from '@prisma/client';
import type { LoginInput, RegisterInput } from '@synchub/contracts';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

interface RefreshPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

type SessionClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) throw new ConflictException('Email is already registered');

    const passwordHash = await hash(input.password, 12);
    const slug = await this.uniqueWorkspaceSlug(this.slugify(input.workspaceName));

    const user = await this.prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });

      await transaction.workspace.create({
        data: {
          name: input.workspaceName,
          slug,
          memberships: {
            create: { userId: createdUser.id, role: WorkspaceRole.OWNER },
          },
          activities: {
            create: {
              actorId: createdUser.id,
              type: 'WORKSPACE_CREATED',
              summary: `Workspace ${input.workspaceName} was created`,
            },
          },
        },
      });

      return createdUser;
    });

    return this.issueSession(user.id, user.email);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user.id, user.email);
  }

  async refresh(rawToken: string) {
    const payload = await this.verifyRefreshToken(rawToken);
    const tokenHash = this.hashToken(rawToken);

    return this.prisma.$transaction(async (transaction) => {
      const storedToken = await transaction.refreshToken.findUnique({
        where: { id: payload.tokenId },
        include: { user: true },
      });

      if (!storedToken || storedToken.userId !== payload.sub || storedToken.tokenHash !== tokenHash) {
        throw new UnauthorizedException('Refresh token is expired or revoked');
      }

      const consumed = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Refresh token is expired or revoked');
      }

      return this.issueSession(storedToken.user.id, storedToken.user.email, transaction);
    });
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        memberships: {
          select: {
            role: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  private async verifyRefreshToken(rawToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh' || !payload.sub || !payload.tokenId) {
        throw new Error('Invalid token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async issueSession(
    userId: string,
    email: string,
    client: SessionClient = this.prisma,
  ) {
    const accessTtlSeconds = Number(this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    const refreshTtlSeconds = Number(
      this.config.get('JWT_REFRESH_TTL_SECONDS') ?? 30 * 24 * 60 * 60,
    );

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSeconds,
      },
    );

    await this.removeStaleSessions(client, userId);
    const tokenRecord = await client.refreshToken.create({
      data: {
        tokenHash: `pending:${randomUUID()}`,
        userId,
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
      },
    });

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, tokenId: tokenRecord.id, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtlSeconds,
      },
    );

    await client.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { tokenHash: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  private removeStaleSessions(client: SessionClient, userId: string) {
    const retentionThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return client.refreshToken.deleteMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: retentionThreshold } },
        ],
      },
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  private async uniqueWorkspaceSlug(base: string) {
    const safeBase = base || 'workspace';
    let candidate = safeBase;
    let suffix = 1;

    while (await this.prisma.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${safeBase}-${suffix}`;
    }

    return candidate;
  }
}
