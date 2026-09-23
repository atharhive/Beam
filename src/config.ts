import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

export const PORT = Number(process.env.PORT || 3000);
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Solana Network & RPC Configuration
export const SOLANA_NETWORK = (process.env.SOLANA_NETWORK || 'devnet').trim().toLowerCase();

export function getSolanaRpcUrl(): string {
  if (process.env.SOLANA_RPC_URL?.trim()) {
    return process.env.SOLANA_RPC_URL.trim();
  }
  if (SOLANA_NETWORK === 'devnet') {
    return 'https://api.devnet.solana.com';
  }
  if (process.env.HELIUS_API_KEY?.trim()) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY.trim()}`;
  }
  return 'https://api.mainnet-beta.solana.com';
}

export const SOLANA_RPC_URL = getSolanaRpcUrl();

// Vybe Network DEX Aggregator & Data API
export const VYBE_API_BASE = (process.env.VYBE_API_BASE || 'https://api.vybenetwork.xyz')
  .trim()
  .replace(/\/$/, '');

export function getVybeApiKey(): string {
  return (process.env.VYBE_API_KEY || process.env.VYBE_DATA_API_KEY || '').trim();
}

export function getVybeDataApiKey(): string {
  return (process.env.VYBE_DATA_API_KEY || process.env.VYBE_API_KEY || '').trim();
}

// Token Constants
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export const USDC_MINT = SOLANA_NETWORK === 'devnet' ? DEVNET_USDC_MINT : MAINNET_USDC_MINT;
export const USDC_DECIMALS = 6;
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const SOL_DECIMALS = 9;

// Payment Intent Defaults
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
export const EXACT_OUT_BUFFER_BPS = 100; // 1.0% buffer for exact-out settlement guarantee
export const DEFAULT_INTENT_EXPIRY_MINUTES = 60; // 1 hour
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
