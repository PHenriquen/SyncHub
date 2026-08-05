import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

const roleWeight: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireRole(userId: string, workspaceId: string, minimumRole: WorkspaceRole) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!membership) throw new NotFoundException('Workspace was not found');
    if (roleWeight[membership.role] < roleWeight[minimumRole]) {
      throw new ForbiddenException('Insufficient workspace permission');
    }

    return membership;
  }
}
