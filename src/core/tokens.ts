import { USDC_MINT, WSOL_MINT } from '../config.js';

export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isPopular?: boolean;
}

export const SUPPORTED_TOKENS: Record<string, TokenMeta> = {
  [USDC_MINT]: {
    mint: USDC_MINT,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    isPopular: true,
  },
  [WSOL_MINT]: {
    mint: WSOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    isPopular: true,
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    isPopular: true,
  },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cEIPA',
    isPopular: true,
  },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png',
    isPopular: true,
  },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    isPopular: true,
  },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    logoURI: 'https://pyth.network/token.svg',
    isPopular: true,
  },
};

export function getTokenByMint(mint: string): TokenMeta | undefined {
  return SUPPORTED_TOKENS[mint.trim()];
}

export function getAllSupportedTokens(): TokenMeta[] {
  return Object.values(SUPPORTED_TOKENS);
}

/**
 * Convert human-readable token amount (e.g. 10.5 SOL) to raw on-chain integer (BigInt).
 */
export function toRawAmount(amount: number, decimals: number): bigint {
  if (isNaN(amount) || amount < 0) return 0n;
  const factor = 10 ** decimals;
  return BigInt(Math.round(amount * factor));
}

/**
 * Convert raw on-chain atomic integer to human-readable UI amount.
 */
export function toUiAmount(rawAmount: bigint | string | number, decimals: number): number {
  const raw = BigInt(rawAmount);
  const factor = 10 ** decimals;
  return Number(raw) / factor;
}

/**
 * Pretty format token amounts for display.
 */
export function formatTokenAmount(amount: number, maxDecimals = 4): string {
  if (amount === 0) return '0';
  if (amount < 0.0001) return '<0.0001';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
  }).format(amount);
}
