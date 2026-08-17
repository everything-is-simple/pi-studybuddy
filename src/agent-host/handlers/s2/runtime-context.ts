import { S2Context } from "./context";
import { createRealTextExtractor, type TextExtractor } from "./text-extractor";
import { createRealWpsAdapter, type WpsAdapter } from "./wps-adapter";
import { createRealOcrAdapter, type OcrAdapter } from "../s1/ocr-adapter";

export interface RuntimeS2Adapters {
  textExtractor?: () => TextExtractor;
  wps?: (pythonPath: string, bridgePath: string) => WpsAdapter;
  ocr?: (pythonPath: string, bridgePath: string) => OcrAdapter;
}

export interface RuntimeS2ContextOptions {
  env?: NodeJS.ProcessEnv;
  isTest?: boolean;
  adapters?: RuntimeS2Adapters;
}

export function createRuntimeS2Context(dataRoot: string, options: RuntimeS2ContextOptions = {}): S2Context {
  const env = options.env ?? process.env;
  const isTest = options.isTest ?? process.env.VITEST !== undefined;
  const adapters = options.adapters ?? {};
  const textExtractorFactory = adapters.textExtractor ?? createRealTextExtractor;
  const wpsFactory = adapters.wps ?? ((pythonPath, bridgePath) => createRealWpsAdapter({ pythonPath, bridgePath }));
  const ocrFactory = adapters.ocr ?? ((pythonPath, bridgePath) => createRealOcrAdapter({ pythonPath, bridgePath }));
  const textExtractor = textExtractorFactory();

  if (isTest) {
    return new S2Context(dataRoot, undefined, textExtractor, undefined);
  }

  return new S2Context(
    dataRoot,
    wpsFactory(env.PI_STUDYBUDDY_WPS_PYTHON ?? "", env.PI_STUDYBUDDY_WPS_BRIDGE ?? ""),
    textExtractor,
    ocrFactory(env.PI_STUDYBUDDY_OCR_PYTHON ?? "", env.PI_STUDYBUDDY_OCR_BRIDGE ?? ""),
  );
}
