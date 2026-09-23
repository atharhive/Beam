import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection, getAssociatedTokenAddress } from '../core/solana.js';
import { intentStore } from '../intent/store.js';
import { SOLANA_NETWORK } from '../config.js';
import type { PaymentIntent } from '../intent/types.js';

export interface VerificationResult {
  verified: boolean;
  status: PaymentIntent['status'];
  txSignature: string;
  solscanUrl: string;
  recipient: string;
  targetAmountRaw: string;
  receivedAmountRaw?: string;
  payerWallet?: string;
  error?: string;
}

/**
 * Verify on-chain settlement for a given payment intent and transaction signature.
 */
export async function verifyPaymentOnChain(
  intentId: string,
  signature: string,
  payerWallet?: string
): Promise<VerificationResult> {
  const intent = intentStore.get(intentId);
  if (!intent) {
    throw new Error(`Payment intent not found: ${intentId}`);
  }

  const clusterParam = SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  const solscanUrl = `https://solscan.io/tx/${signature}${clusterParam}`;

  // If already paid with same signature
  if (intent.status === 'paid' && intent.paymentTxSignature === signature) {
    return {
      verified: true,
      status: 'paid',
      txSignature: signature,
      solscanUrl,
      recipient: intent.recipient,
      targetAmountRaw: intent.targetAmountRaw,
      receivedAmountRaw: intent.paidAmountRaw,
      payerWallet: intent.payerWallet,
    };
  }

  const connection = getSolanaConnection();

  // 1. Check signature status
  const statusRes = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });

  const sigStatus = statusRes?.value;
  if (!sigStatus) {
    return {
      verified: false,
      status: 'pending',
      txSignature: signature,
      solscanUrl,
      recipient: intent.recipient,
      targetAmountRaw: intent.targetAmountRaw,
      error: 'Transaction not found or not yet processed by RPC',
    };
  }

  // If transaction encountered an on-chain execution error
  if (sigStatus.err) {
    intentStore.updateStatus(intentId, 'failed', {
      payerWallet,
      paymentTxSignature: signature,
    });
    return {
      verified: false,
      status: 'failed',
      txSignature: signature,
      solscanUrl,
      recipient: intent.recipient,
      targetAmountRaw: intent.targetAmountRaw,
      error: `Transaction failed on-chain: ${JSON.stringify(sigStatus.err)}`,
    };
  }

  // 2. Fetch parsed transaction to calculate balance delta
  const parsedTx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed',
  });

  if (!parsedTx || !parsedTx.meta) {
    // Transaction confirmed but details not yet fully available in history
    return {
      verified: false,
      status: 'pending',
      txSignature: signature,
      solscanUrl,
      recipient: intent.recipient,
      targetAmountRaw: intent.targetAmountRaw,
      error: 'Transaction confirmed, awaiting indexed balance records',
    };
  }

  const recipientPubkey = new PublicKey(intent.recipient);
  const targetMintPubkey = new PublicKey(intent.targetMint);
  const expectedAta = getAssociatedTokenAddress(targetMintPubkey, recipientPubkey, true);
  const expectedAtaStr = expectedAta.toBase58();

  // Inspect pre and post token balances
  const preBalances = parsedTx.meta.preTokenBalances || [];
  const postBalances = parsedTx.meta.postTokenBalances || [];

  const preTokenRecord = preBalances.find(
    (b) => (b.owner === intent.recipient || b.accountIndex !== undefined) && b.mint === intent.targetMint
  );

  const postTokenRecord = postBalances.find(
    (b) => (b.owner === intent.recipient || b.accountIndex !== undefined) && b.mint === intent.targetMint
  );

  const preAmount = preTokenRecord ? BigInt(preTokenRecord.uiTokenAmount.amount) : 0n;
  const postAmount = postTokenRecord ? BigInt(postTokenRecord.uiTokenAmount.amount) : 0n;
  const deltaReceived = postAmount > preAmount ? postAmount - preAmount : 0n;

  const targetAmountRaw = BigInt(intent.targetAmountRaw);

  // Derive actual payer signer if not passed
  let detectedPayer = payerWallet;
  if (!detectedPayer && parsedTx.transaction.message.accountKeys.length > 0) {
    const feePayer = parsedTx.transaction.message.accountKeys[0];
    detectedPayer = typeof feePayer === 'string' ? feePayer : feePayer.pubkey.toBase58();
  }

  // Check native SOL transfer delta if token balance delta is 0
  let solDeltaReceived = 0n;
  const recipientIndex = parsedTx.transaction.message.accountKeys.findIndex((k: any) => {
    const keyStr = typeof k === 'string' ? k : k.pubkey?.toBase58 ? k.pubkey.toBase58() : '';
    return keyStr === intent.recipient;
  });

  if (recipientIndex !== -1 && parsedTx.meta.postBalances && parsedTx.meta.preBalances) {
    const preSol = BigInt(parsedTx.meta.preBalances[recipientIndex] || 0);
    const postSol = BigInt(parsedTx.meta.postBalances[recipientIndex] || 0);
    if (postSol > preSol) {
      solDeltaReceived = postSol - preSol;
    }
  }

  const isConfirmedPaid = deltaReceived >= targetAmountRaw || solDeltaReceived > 0n;

  if (isConfirmedPaid) {
    const finalPaidRaw = deltaReceived > 0n ? deltaReceived.toString() : solDeltaReceived.toString();
    intentStore.updateStatus(intentId, 'paid', {
      payerWallet: detectedPayer,
      paymentTxSignature: signature,
      paidAmountRaw: finalPaidRaw,
    });

    return {
      verified: true,
      status: 'paid',
      txSignature: signature,
      solscanUrl,
      recipient: intent.recipient,
      targetAmountRaw: intent.targetAmountRaw,
      receivedAmountRaw: finalPaidRaw,
      payerWallet: detectedPayer,
    };
  }

  if (deltaReceived > 0n && deltaReceived < targetAmountRaw) {
    intentStore.updateStatus(intentId, 'underpaid', {
      payerWallet: detectedPayer,
      paymentTxSignature: signature,
      paidAmountRaw: deltaReceived.toString(),
    });

    return {
      verified: false,
      status: 'underpaid',
      txSignature: signature,
      solscanUrl,
      recipient: intent.recipient,
      targetAmountRaw: intent.targetAmountRaw,
      receivedAmountRaw: deltaReceived.toString(),
      error: `Underpaid: received ${deltaReceived} base units, expected ${targetAmountRaw}`,
    };
  }

  // Fallback: If token accounts balance wasn't recorded directly or if it was a mock/test signature
  return {
    verified: false,
    status: 'pending',
    txSignature: signature,
    solscanUrl,
    recipient: intent.recipient,
    targetAmountRaw: intent.targetAmountRaw,
    error: 'Could not verify recipient balance delta on-chain',
  };
}
