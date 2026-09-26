export interface ObjectExistencePort {
  exists(storageKey: string): Promise<boolean>;
  existsMany?(storageKeys: readonly string[]): Promise<ReadonlyMap<string, boolean>>;
}

export const OBJECT_EXISTENCE_PORT = "catalog-import-object-existence";
