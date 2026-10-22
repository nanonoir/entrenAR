import { PaymentWorkersService } from "./payment-workers.service";

function build(enabled: boolean) {
  const registry = { addInterval: jest.fn(), deleteInterval: jest.fn(), getIntervals: jest.fn().mockReturnValue(["payment-inbox"]) };
  const inbox = { processDue: jest.fn().mockResolvedValue([]) };
  const service = new PaymentWorkersService(
    { get: jest.fn().mockReturnValue(enabled) } as never,
    registry as never,
    inbox as never,
    { expireDue: jest.fn(), reconcileDue: jest.fn() } as never,
    { sweep: jest.fn() } as never,
  );
  return { inbox, registry, service };
}

describe("PaymentWorkersService", () => {
  it("registers no timers when workers are disabled", () => {
    const { registry, service } = build(false);
    service.onApplicationBootstrap();
    expect(registry.addInterval).not.toHaveBeenCalled();
  });

  it("registers the five workers when enabled", () => {
    const { registry, service } = build(true);
    service.onApplicationBootstrap();
    expect(registry.addInterval.mock.calls.map(([name]) => name).sort()).toEqual([
      "payment-attention", "payment-expiry", "payment-financial", "payment-inbox", "payment-reconcile",
    ]);
    registry.addInterval.mock.calls.forEach(([, timer]) => clearInterval(timer as NodeJS.Timeout));
  });

  it("stops claiming new work once shutdown begins and never overlaps a running tick", async () => {
    const { service } = build(true);
    let release: () => void = () => undefined;
    const run = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const worker = { intervalMs: 1, name: "w", run };

    const first = service.tick(worker);
    await service.tick(worker);
    expect(run).toHaveBeenCalledTimes(1);
    const shutdown = service.beforeApplicationShutdown();
    release();
    await Promise.all([first, shutdown]);

    await service.tick(worker);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
