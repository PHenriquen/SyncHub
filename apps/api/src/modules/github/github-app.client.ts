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
        pageRepositories = parseInstallationRepositoryPage(await response.json());
      } catch {
        throw new ServiceUnavailableException('GitHub repository discovery returned an invalid response');
      }

      for (const repository of pageRepositories) {
        if (!seenRepositoryIds.has(repository.repositoryId)) {
          seenRepositoryIds.add(repository.repositoryId);
          repositories.push(repository);
        }
      }

      if (pageRepositories.length < 100) return repositories;
    }

    throw new ServiceUnavailableException('GitHub repository discovery exceeded its page limit');
  }
}
