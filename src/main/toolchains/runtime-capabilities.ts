import type { ToolchainStatus } from "../../contract/types";
import {
  getManagedRuntimeResourcesForCurrentApp,
  loadManagedRuntimeResources,
  resolveVerifiedManagedResource,
  type RuntimeResourcesLocation,
} from "../../agent-host/runtime-resources";

const MSG_MANIFEST_MISSING = "应用运行资源缺失，请修复或重新安装应用";
const MSG_OPTIONAL_NOT_CONFIGURED = "可选学习能力未配置，不影响其它学习功能";
const MSG_CONFIGURED_UNVERIFIED = "已配置路径，需在本机显式测试后确认可用";
const MSG_WPS_EXTERNAL = "WPS/Office 为外部可选依赖，不随应用安装";
const MSG_SAPI_WINDOWS = "Windows 系统语音能力可用于离线朗读";
const MSG_SAPI_UNSUPPORTED = "当前系统未提供 Windows SAPI 离线朗读";

export interface RuntimeCapabilityProbeInput {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  managedSkillCount?: number;
  manifestAvailable?: boolean;
  runtimeResourcesLocation?: RuntimeResourcesLocation;
}

function hasValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function status(item: ToolchainStatus): ToolchainStatus {
  return item;
}

function currentRuntimeManifestState(location?: RuntimeResourcesLocation): { manifestAvailable: boolean; managedSkillCount: number } {
  try {
    const resolvedLocation = location ?? getManagedRuntimeResourcesForCurrentApp();
    const manifest = loadManagedRuntimeResources(resolvedLocation);
    const nativeSkills = manifest.resources.filter((resource) => resource.kind === "native-skill");
    for (const resource of nativeSkills) resolveVerifiedManagedResource(resolvedLocation, resource);
    return {
      manifestAvailable: true,
      managedSkillCount: nativeSkills.length,
    };
  } catch {
    return { manifestAvailable: false, managedSkillCount: 0 };
  }
}

export function buildRuntimeCapabilityStatuses(input: RuntimeCapabilityProbeInput = {}): ToolchainStatus[] {
  const platform = input.platform ?? process.platform;
  const env = input.env ?? process.env;
  const detected = input.managedSkillCount === undefined || input.manifestAvailable === undefined
    ? currentRuntimeManifestState(input.runtimeResourcesLocation)
    : { manifestAvailable: input.manifestAvailable, managedSkillCount: input.managedSkillCount };
  const managedSkillCount = input.managedSkillCount ?? detected.managedSkillCount;
  const manifestAvailable = input.manifestAvailable ?? detected.manifestAvailable;
  const ocrConfigured = hasValue(env.PI_STUDYBUDDY_OCR_PYTHON) && hasValue(env.PI_STUDYBUDDY_OCR_BRIDGE);
  const whisperConfigured = hasValue(env.PI_STUDYBUDDY_WHISPER_CLI) && hasValue(env.PI_STUDYBUDDY_WHISPER_MODEL);
  const edgeTtsConfigured = hasValue(env.PI_STUDYBUDDY_EDGE_TTS_CLI);

  return [
    status({
      capabilityId: "runtime.pi",
      name: "pi runtime",
      health: manifestAvailable ? "healthy" : "unsupported",
      source: "bundled",
      managed: true,
      required: true,
      ...(manifestAvailable ? {} : { reason: MSG_MANIFEST_MISSING, recovery: "重新安装或修复应用运行资源" }),
    }),
    status({
      capabilityId: "runtime.studybuddy-extension",
      name: "StudyBuddy extension",
      health: manifestAvailable ? "healthy" : "unsupported",
      source: "bundled",
      managed: true,
      required: true,
      ...(manifestAvailable ? {} : { reason: MSG_MANIFEST_MISSING, recovery: "重新安装或修复应用运行资源" }),
    }),
    status({
      capabilityId: "runtime.native-skills",
      name: "学习技能",
      health: manifestAvailable && managedSkillCount > 0 ? "healthy" : "unsupported",
      version: `${managedSkillCount} skills`,
      source: "bundled",
      managed: true,
      required: true,
      ...(manifestAvailable && managedSkillCount > 0 ? {} : { reason: MSG_MANIFEST_MISSING, recovery: "重新安装或修复应用学习技能" }),
    }),
    status({
      capabilityId: "tts.sapi",
      name: "SAPI 离线朗读",
      health: platform === "win32" ? "healthy" : "unsupported",
      source: "os",
      managed: false,
      required: true,
      reason: platform === "win32" ? MSG_SAPI_WINDOWS : MSG_SAPI_UNSUPPORTED,
      recovery: platform === "win32" ? "检查 Windows 语音设置" : "切换到支持的朗读引擎",
    }),
    status({
      capabilityId: "tts.edge-tts",
      name: "edge-tts 可选朗读",
      health: edgeTtsConfigured ? "unverified" : "unsupported",
      source: "configured",
      managed: false,
      required: false,
      reason: edgeTtsConfigured ? MSG_CONFIGURED_UNVERIFIED : MSG_OPTIONAL_NOT_CONFIGURED,
      recovery: "在设置中配置 edge-tts 后手动测试",
    }),
    status({
      capabilityId: "learning.ocr",
      name: "本地 OCR",
      health: ocrConfigured ? "unverified" : "unsupported",
      source: "configured",
      managed: false,
      required: false,
      reason: ocrConfigured ? MSG_CONFIGURED_UNVERIFIED : MSG_OPTIONAL_NOT_CONFIGURED,
      recovery: "完成 OCR 运行资产装配后手动测试",
    }),
    status({
      capabilityId: "learning.whisper",
      name: "课堂语音转写",
      health: whisperConfigured ? "unverified" : "unsupported",
      source: "configured",
      managed: false,
      required: false,
      reason: whisperConfigured ? MSG_CONFIGURED_UNVERIFIED : MSG_OPTIONAL_NOT_CONFIGURED,
      recovery: "配置 whisper.cpp CLI 与模型后手动测试",
    }),
    status({
      capabilityId: "learning.wps",
      name: "WPS/Office 旧格式转换",
      health: "unverified",
      source: "external_optional",
      managed: false,
      required: false,
      reason: MSG_WPS_EXTERNAL,
      recovery: "安装并授权 WPS/Office 后手动测试旧格式转换",
    }),
  ];
}
