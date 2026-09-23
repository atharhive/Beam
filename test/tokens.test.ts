import { expect, test, describe } from 'bun:test';
import {
  toRawAmount,
  toUiAmount,
  formatTokenAmount,
  getTokenByMint,
  SUPPORTED_TOKENS,
} from '../src/core/tokens.js';
import { USDC_MINT, WSOL_MINT } from '../src/config.js';

describe('Token Utilities', () => {
  test('converts human amount to raw integer correctly', () => {
    // 10 USDC (6 decimals)
    expect(toRawAmount(10, 6)).toBe(10000000n);
    // 1.5 SOL (9 decimals)
    expect(toRawAmount(1.5, 9)).toBe(1500000000n);
    // 0 amount
    expect(toRawAmount(0, 6)).toBe(0n);
  });

  test('converts raw integer to human amount correctly', () => {
    expect(toUiAmount(10000000n, 6)).toBe(10);
    expect(toUiAmount('1500000000', 9)).toBe(1.5);
  });

  test('formats token amounts for display', () => {
    expect(formatTokenAmount(10.5)).toBe('10.5');
    expect(formatTokenAmount(0.00001)).toBe('<0.0001');
    expect(formatTokenAmount(0)).toBe('0');
  });

  test('retrieves registered token metadata', () => {
    const usdc = getTokenByMint(USDC_MINT);
    expect(usdc).toBeDefined();
    expect(usdc?.symbol).toBe('USDC');
    expect(usdc?.decimals).toBe(6);

    const sol = getTokenByMint(WSOL_MINT);
    expect(sol).toBeDefined();
    expect(sol?.symbol).toBe('SOL');
    expect(sol?.decimals).toBe(9);
  });
});
