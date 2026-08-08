import { afterEach, describe, expect, it } from "vitest";
import { launchElectron, type LaunchedApp } from "./helpers/electron-launcher";
import { RpcDriver } from "./helpers/rpc-driver";

describe("T-M4-022 全量 E2E Electron 进程边界", () => {
  let app: LaunchedApp | undefined;

  afterEach(async () => {
    await app?.dispose();
    app = undefined;
  });

  it("业务 E2E harness 由真实 Electron 主进程承载，并完成真实 RPC", async () => {
    app = await launchElectron("electron-launcher-runtime");

    expect(app.runtime.electron).toBe("36.9.5");
    expect(app.runtime.node).toBe("22.19.0");

    const rpc = new RpcDriver(app.channel);
    await expect(
      rpc.call("system.ping", { message: "T-M4-022-real-electron" }),
    ).resolves.toMatchObject({ pong: "T-M4-022-real-electron" });
  });
});
