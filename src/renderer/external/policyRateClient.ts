/* eslint-disable no-console */
import { useAppSettings } from "@/renderer/store/settings.js";
import api from "@/renderer/ipc/api.js";

const DEFAULT_URL = "http://127.0.0.1:8765";
const TIMEOUT_MS = 5000;

export type PolicyMove = {
  usi: string;
  rate: number;
  percent: string;
};

export type PolicyResponse = {
  sfen: string;
  moves: PolicyMove[];
};

export async function fetchPolicyRates(sfen: string): Promise<PolicyResponse | null> {
  const rawUrl = useAppSettings().policyRateApiUrl;
  const baseUrl = rawUrl ? rawUrl.replace(/\/+$/, "") : DEFAULT_URL;
  const url = `${baseUrl}/policy`;
  const body = JSON.stringify({ sfen: `position sfen ${sfen}`, topN: 7 });

  console.log("[PolicyRate] URL:", url);
  console.log("[PolicyRate] request body:", body);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
  );

  try {
    const text = await Promise.race([api.fetchPolicyRate(url, body), timeoutPromise]);
    const data = JSON.parse(text) as PolicyResponse;
    console.log("[PolicyRate] moves:", data.moves?.length, data.moves);
    return data;
  } catch (e) {
    console.log("[PolicyRate] fetch error:", e);
    return null;
  }
}
