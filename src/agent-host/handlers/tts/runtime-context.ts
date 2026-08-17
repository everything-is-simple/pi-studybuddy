import { TtsContext, type TtsContextOptions } from "./context";
import type { TtsAdapter } from "./tts-adapter";
import {
  createMockTtsAdapter,
  createRealEdgeTtsAdapter,
  createRealSapiAdapter,
} from "./tts-adapter";

export interface RuntimeTtsAdapters {
  sapi?: (sapiCliPath?: string) => TtsAdapter;
  edge?: (edgeTtsCliPath: string) => TtsAdapter;
  mock?: () => TtsAdapter;
}

export interface RuntimeTtsContextOptions {
  env?: NodeJS.ProcessEnv;
  isTest?: boolean;
  emit?: TtsContextOptions["emit"];
  adapters?: RuntimeTtsAdapters;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createRuntimeTtsContext(options: RuntimeTtsContextOptions = {}): TtsContext {
  const env = options.env ?? process.env;
  const isTest = options.isTest ?? process.env.VITEST !== undefined;
  const adapters = options.adapters ?? {};
  const mockFactory = adapters.mock ?? createMockTtsAdapter;
  const sapiFactory = adapters.sapi ?? ((sapiCliPath?: string) => createRealSapiAdapter({ sapiCliPath }));
  const edgeFactory = adapters.edge ?? ((edgeTtsCliPath: string) => createRealEdgeTtsAdapter({ edgeTtsCliPath }));

  if (isTest) {
    return new TtsContext({
      sapiAdapter: mockFactory(),
      edgeTtsAdapter: mockFactory(),
      currentEngine: "sapi",
      emit: options.emit,
    });
  }

  const edgeTtsCliPath = env.PI_STUDYBUDDY_EDGE_TTS_CLI;
  return new TtsContext({
    sapiAdapter: sapiFactory(env.PI_STUDYBUDDY_SAPI_CLI),
    edgeTtsAdapter: edgeFactory(nonEmpty(edgeTtsCliPath) ? edgeTtsCliPath : ""),
    currentEngine: "sapi",
    emit: options.emit,
  });
}
