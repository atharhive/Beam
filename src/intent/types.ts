export type PaymentStatus =
  | 'created'    // Intent created, awaiting payer
  | 'pending'    // Payer initiated/building transaction
  | 'paid'       // Confirmed on-chain, target USDC received
  | 'expired'    // Intent passed expiration timestamp
  | 'underpaid'  // Received on-chain, but less than target amount
  | 'failed';    // Transaction reverted or failed

export interface PaymentIntent {
  id: string;
  recipient: string;            // Recipient's Solana wallet address
  targetMint: string;           // Target token mint (USDC)
  targetSymbol: string;         // E.g. 'USDC'
  targetAmount: number;         // Human readable amount (e.g. 10.00)
  targetAmountRaw: string;      // Base units (e.g. "10000000" for 10 USDC)
  decimals: number;             // E.g. 6 for USDC
  memo?: string;                // Optional reference note (e.g. "Invoice #42")
  createdAt: number;            // Creation timestamp (epoch ms)
  expiresAt: number;            // Expiration timestamp (epoch ms)
  status: PaymentStatus;
  
  // Populated upon payment
  payerWallet?: string;
  paymentTxSignature?: string;
  paidAmountRaw?: string;
  paidAt?: number;
}

export interface CreatePaymentIntentInput {
  recipient: string;
  targetAmount: number;
  targetMint?: string;
  memo?: string;
  expiresInMinutes?: number;
}
