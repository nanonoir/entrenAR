let generation = 0;

export function getAdminSessionGeneration(): number { return generation; }
export function invalidateAdminSession(): void { generation += 1; }
