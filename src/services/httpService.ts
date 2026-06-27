// src/services/httpService.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import logger from '../logger/index.js';

const RETRY_DELAYS_MS = [2000, 5000, 10000]; // 3 retries with backoff

export async function httpPost<T>(
  client: AxiosInstance,
  url: string,
  data: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await client.post<T>(url, data, config);
      return response.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const delayMs = RETRY_DELAYS_MS[attempt];
      if (delayMs !== undefined) {
        logger.warn(
          `HTTP POST to ${url} failed (attempt ${attempt + 1}): ${error.message}. Retrying in ${delayMs}ms…`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

export async function httpGet<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await client.get<T>(url, config);
      return response.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const delayMs = RETRY_DELAYS_MS[attempt];
      if (delayMs !== undefined) {
        logger.warn(
          `HTTP GET to ${url} failed (attempt ${attempt + 1}): ${error.message}. Retrying in ${delayMs}ms…`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

export function createHttpClient(baseURL?: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 120_000, // 2-minute timeout for video uploads
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
