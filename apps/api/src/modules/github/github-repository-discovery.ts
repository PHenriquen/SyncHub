export interface InstallationRepository {
  repositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseInstallationRepositoryPage(payload: unknown): InstallationRepository[] {
  if (!isRecord(payload) || !Array.isArray(payload.repositories)) {
    throw new Error('GitHub repository discovery returned an invalid page');
  }

  return payload.repositories.map((value: unknown) => {
    if (!isRecord(value) || !isRecord(value.owner)) {
      throw new Error('GitHub repository discovery returned an invalid repository');
    }

    const { id, name, full_name: fullName, default_branch: defaultBranch, private: isPrivate } = value;
    const owner = value.owner.login;

    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !nonEmptyString(name) ||
      !nonEmptyString(fullName) ||
      !nonEmptyString(defaultBranch) ||
      !nonEmptyString(owner) ||
      typeof isPrivate !== 'boolean' ||
      fullName !== `${owner}/${name}`
    ) {
      throw new Error('GitHub repository discovery returned an invalid repository');
    }

    return { repositoryId: id, owner, name, fullName, defaultBranch, private: isPrivate };
  });
}
