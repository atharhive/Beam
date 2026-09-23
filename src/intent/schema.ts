import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import { USDC_MINT, DEFAULT_INTENT_EXPIRY_MINUTES } from '../config.js';

function isValidSolanaPublicKey(address: string): boolean {
  try {
    new PublicKey(address.trim());
    return true;
  } catch {
    return false;
  }
}

export const CreatePaymentIntentSchema = z.object({
  recipient: z
    .string()
    .trim()
    .min(32, 'Recipient address too short')
    .max(44, 'Recipient address too long')
    .refine(isValidSolanaPublicKey, 'Invalid Solana public key'),
  targetAmount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Target amount must be greater than 0')
    .max(10_000_000, 'Target amount exceeds maximum limit'),
  targetMint: z
    .string()
    .trim()
    .refine(isValidSolanaPublicKey, 'Invalid token mint')
    .optional()
    .default(USDC_MINT),
  memo: z
    .string()
    .trim()
    .max(128, 'Memo must not exceed 128 characters')
    .optional(),
  expiresInMinutes: z
    .number()
    .int('Expiration minutes must be an integer')
    .min(1, 'Expiration must be at least 1 minute')
    .max(10080, 'Expiration cannot exceed 7 days')
    .optional()
    .default(DEFAULT_INTENT_EXPIRY_MINUTES),
});

export const VerifyPaymentIntentSchema = z.object({
  signature: z
    .string()
    .trim()
    .min(64, 'Invalid Solana transaction signature')
    .max(128, 'Signature string too long'),
  payerWallet: z
    .string()
    .trim()
    .refine(isValidSolanaPublicKey, 'Invalid payer wallet address')
    .optional(),
});
