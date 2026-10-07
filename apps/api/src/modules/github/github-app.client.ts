import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InstallationRepository {
  repositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  owner: { login: string };
}

interface InstallationRepositoriesResponse {
  repositories?: GitHubRepositoryResponse[];
}

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

    for (let page = 1; ; page += 1) {
      const response = await fetch(
        `${apiBaseUrl}/installation/repositories?per_page=100&page=${page}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${installationToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'SyncHub',
          },
        },
      );

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `GitHub repository discovery failed for installation ${installationId.toString()} (${response.status})`,
        );
      }

      const payload = (await response.json()) as InstallationRepositoriesResponse;
      const pageRepositories = payload.repositories ?? [];
      repositories.push(...pageRepositories.map(normalizeRepository));

      if (pageRepositories.length < 100) break;
    }

    return repositories;
  }
}

function normalizeRepository(repository: GitHubRepositoryResponse): InstallationRepository {
  return {
    repositoryId: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    private: repository.private,
  };
}
