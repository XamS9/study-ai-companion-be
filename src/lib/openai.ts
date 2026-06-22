import OpenAI from 'openai';
import { env } from '../config/env.js';

/**
 * Lazily-created OpenAI client (the only paid dependency). Returns null when no
 * API key is configured so AI endpoints can degrade gracefully (HTTP 503) instead
 * of crashing the server on boot.
 */
let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

export const OPENAI_MODEL = env.OPENAI_MODEL;
