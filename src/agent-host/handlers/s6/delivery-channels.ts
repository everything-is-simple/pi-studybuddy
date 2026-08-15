/**
 * T-M2-002 S6 delivery channels. Mock channels remain test-only; production
 * SMTP and Feishu channels perform real network I/O and never log credentials.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import tls from "node:tls";
import path from "node:path";

export interface DeliveryResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface DeliverableReport {
  reportKey: string;
  contentJson: string;
  contentHash: string;
  reportType: string;
}

/** channelConfigJson plus an in-memory credential injected by the host. */
export interface ChannelConfig {
  [key: string]: unknown;
}

export interface DeliveryChannel {
  deliver(report: DeliverableReport, config: ChannelConfig): DeliveryResult | Promise<DeliveryResult>;
}

function createLocalExportChannel(): DeliveryChannel {
  return {
    deliver(report, config) {
      try {
        const dir = typeof config.dir === "string" ? config.dir : "./reports";
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, `${report.reportKey}.json`), report.contentJson, "utf-8");
        return { success: true };
      } catch {
        return { success: false, errorCode: "LOCAL_EXPORT_FAILED", errorMessage: "本地导出失败" };
      }
    },
  };
}

function reportMessage(report: DeliverableReport): string {
  return `Pi StudyBuddy 家长报告\n\n${report.contentJson}`;
}

function smtpResponse(socket: net.Socket | tls.TLSSocket, expected: number[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";
      const line = lines.at(-1) ?? "";
      if (!/^\d{3} /.test(line)) return;
      const code = Number(line.slice(0, 3));
      socket.off("data", onData);
      if (expected.includes(code)) resolve();
      else reject(new Error(`smtp-${code}`));
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

function smtpWrite(socket: net.Socket | tls.TLSSocket, command: string, expected: number[]): Promise<void> {
  socket.write(`${command}\r\n`);
  return smtpResponse(socket, expected);
}

function createSmtpChannel(): DeliveryChannel {
  return {
    async deliver(report, config) {
      const host = typeof config.host === "string" ? config.host : "";
      const to = typeof config.to === "string" ? config.to : "";
      const password = typeof config.credentialValue === "string" ? config.credentialValue : "";
      const port = typeof config.port === "number" ? config.port : 465;
      const from = typeof config.from === "string" ? config.from : to;
      if (!host || !to || !password) return { success: false, errorCode: "SMTP_TARGET_INVALID", errorMessage: "邮件目标配置不完整" };
      let socket: net.Socket | tls.TLSSocket | undefined;
      try {
        const activeSocket = port === 465 ? tls.connect({ host, port, servername: host }) : net.createConnection({ host, port });
        socket = activeSocket;
        await new Promise<void>((resolve, reject) => {
          activeSocket.once("secureConnect", resolve);
          activeSocket.once("connect", resolve);
          activeSocket.once("error", reject);
        });
        await smtpResponse(activeSocket, [220]);
        await smtpWrite(activeSocket, "EHLO localhost", [250]);
        await smtpWrite(activeSocket, "AUTH LOGIN", [334]);
        await smtpWrite(activeSocket, Buffer.from(from).toString("base64"), [334]);
        await smtpWrite(activeSocket, Buffer.from(password).toString("base64"), [235]);
        await smtpWrite(activeSocket, `MAIL FROM:<${from}>`, [250]);
        await smtpWrite(activeSocket, `RCPT TO:<${to}>`, [250, 251]);
        await smtpWrite(activeSocket, "DATA", [354]);
        activeSocket.write(`From: ${from}\r\nTo: ${to}\r\nSubject: Pi StudyBuddy report\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${reportMessage(report)}\r\n.\r\n`);
        await smtpResponse(activeSocket, [250]);
        activeSocket.end("QUIT\r\n");
        return { success: true };
      } catch {
        socket?.destroy();
        return { success: false, errorCode: "SMTP_DELIVERY_FAILED", errorMessage: "邮件投递失败" };
      }
    },
  };
}

function createFeishuWebhookChannel(): DeliveryChannel {
  return {
    async deliver(report, config) {
      const url = typeof config.credentialValue === "string" ? config.credentialValue : "";
      if (!url || !/^https:\/\//i.test(url)) return { success: false, errorCode: "FEISHU_TARGET_INVALID", errorMessage: "飞书目标配置不完整" };
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ msg_type: "text", content: { text: reportMessage(report) } }),
        });
        if (!response.ok) return { success: false, errorCode: "FEISHU_DELIVERY_FAILED", errorMessage: "飞书投递失败" };
        const body = await response.json().catch(() => ({})) as { code?: number; StatusCode?: number };
        if ((body.code ?? body.StatusCode ?? 0) !== 0) return { success: false, errorCode: "FEISHU_DELIVERY_FAILED", errorMessage: "飞书投递失败" };
        return { success: true };
      } catch {
        return { success: false, errorCode: "FEISHU_DELIVERY_FAILED", errorMessage: "飞书投递失败" };
      }
    },
  };
}

function createPrintChannel(): DeliveryChannel {
  return { deliver: () => ({ success: false, errorCode: "PRINT_UNAVAILABLE", errorMessage: "打印渠道不可用" }) };
}

export interface DeliveryChannels {
  local_export: DeliveryChannel;
  smtp: DeliveryChannel;
  feishu_webhook: DeliveryChannel;
  print: DeliveryChannel;
}

export function createMockDeliveryChannels(): DeliveryChannels {
  return {
    local_export: createLocalExportChannel(),
    smtp: { deliver: () => ({ success: true }) },
    feishu_webhook: { deliver: () => ({ success: true }) },
    print: { deliver: () => ({ success: true }) },
  };
}

export function createProductionDeliveryChannels(): DeliveryChannels {
  return {
    local_export: createLocalExportChannel(),
    smtp: createSmtpChannel(),
    feishu_webhook: createFeishuWebhookChannel(),
    print: createPrintChannel(),
  };
}

export function createFailingDeliveryChannel(): DeliveryChannel {
  return { deliver: () => ({ success: false, errorCode: "CHANNEL_FAILED", errorMessage: "渠道投递失败（mock）" }) };
}
