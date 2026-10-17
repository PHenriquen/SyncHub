import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseInstallationRepositoryPage } from './github-repository-discovery.js';
import type { InstallationRepository } from './github-repository-discovery.js';

export type { InstallationRepository } from './github-repository-discovery.js';

const MAX_DISCOVERY_PAGES = 100;
const DISCOVERY_TIMEOUT_MS = 10_000;

@Injectable()
export class GitHubAppClient {
  constructor(private readonly config: ConfigService) {}

  async listInstallationRepositories(
    installationId: bigint,
    installationToken: string,
  ): Promise<InstallationRepository[]> {
    if (!installationToken) {
      throw new ServiceUnavailableException('GitHub installation token is unavailable');
    }

    const apiBaseUrl = this.config.get<string>('GITHUB_API_URL') ?? 'https://api.github.com';
    const repositories: InstallationRepository[] = [];
    const seenRepositoryIds = new Set<number>();
    let expectedCount: number | undefined;

    for (let page = 1; page <= MAX_DISCOVERY_PAGES; page += 1) {
      let response: Response;
      try {
        response = await fetch(
          `${apiBaseUrl}/installation/repositories?per_page=100&page=${page}`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${installationToken}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'SyncHub',
            },
            signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
          },
        );
      } catch {
        throw new ServiceUnavailableException('GitHub repository discovery request failed');
      }

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `GitHub repository discovery failed for installation ${installationId.toString()} (${response.status})`,
        );
      }

      let pageRepositories: InstallationRepository[];
      try {
        const payload: unknown = await response.json();
        pageRepositories = parseInstallationRepositoryPage(payload);
        if (!payload || typeof payload !== 'object' || !('total_count' in payload)) {
          throw new Error('Missing repository count');
        }
        const count = payload.total_count;
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
          throw new Error('Invalid repository count');
        }
        if (expectedCount !== undefined && expectedCount !== count) {
          throw new Error('Repository count changed during discovery');
        }
        expectedCount = count;
      } catch {
        throw new ServiceUnavailableException('GitHub repository discovery returned an invalid response');
      }

      for (const repository of pageRepositories) {
        if (!seenRepositoryIds.has(repository.repositoryId)) {
          seenRepositoryIds.add(repository.repositoryId);
          repositories.push(repository);
        }
      }

      if (repositories.length === expectedCount) return repositories;
      if (pageRepositories.length < 100) {
        throw new ServiceUnavailableException('GitHub repository discovery returned an incomplete result');
      }
    }

    throw new ServiceUnavailableException('GitHub repository discovery exceeded its page limit');
  }
}
