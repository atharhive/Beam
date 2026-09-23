import {
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  SystemProgram,
  type AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { getSolanaConnection, getLatestBlockhash, getAssociatedTokenAddress } from '../core/solana.js';
import { USDC_MINT, USDC_DECIMALS, WSOL_MINT, SOLANA_NETWORK } from '../config.js';
import { getTokenByMint } from '../core/tokens.js';
import type { PaymentIntent } from '../intent/types.js';

export interface ComposePaymentTxParams {
  payerPublicKey: string;
  intent: PaymentIntent;
  inputMint?: string;
  requiredInputRaw?: string;
  swapTransactionBase64?: string; // If swap was performed; omitted if direct payment
}

export interface ComposedPaymentTxResult {
  transactionBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  recipientAta: string;
  payerAta: string;
  amountTransferredRaw: string;
}

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Compose an atomic VersionedTransaction (v0) combining the DEX swap and final transfer to recipient.
 */
export async function composeAtomicPaymentTransaction(
  params: ComposePaymentTxParams
): Promise<ComposedPaymentTxResult> {
  const connection = getSolanaConnection();
  const payerPubkey = new PublicKey(params.payerPublicKey.trim());
  const recipientPubkey = new PublicKey(params.intent.recipient.trim());
  const targetMintPubkey = new PublicKey(params.intent.targetMint || USDC_MINT);
  const targetAmountRaw = BigInt(params.intent.targetAmountRaw);

  const tokenMeta = getTokenByMint(params.intent.targetMint) || {
    decimals: USDC_DECIMALS,
  };
  const decimals = tokenMeta.decimals;

  // Instructions to be executed
  const settlementInstructions: TransactionInstruction[] = [];
  let payerAta: PublicKey | null = null;
  let recipientAta: PublicKey | null = null;

  const isDevnet = SOLANA_NETWORK === 'devnet';
  const isDirectTokenSettlement = !params.swapTransactionBase64 && params.inputMint === params.intent.targetMint;
  const isPayingInNativeSol =
    !params.swapTransactionBase64 &&
    (params.inputMint === WSOL_MINT || !params.inputMint || (isDevnet && !isDirectTokenSettlement));

  if (isPayingInNativeSol) {
    // Direct SOL transfer (e.g. native SOL, or simulated token swap settlement on Devnet):
    let lamportsToSend: bigint;
    if (params.inputMint === WSOL_MINT || !params.inputMint) {
      lamportsToSend = BigInt(params.requiredInputRaw || '10000000');
    } else {
      // Calculate equivalent SOL for target USDC amount at reference rate ($155/SOL + 1% buffer)
      const targetUsdc = Number(params.intent.targetAmount);
      lamportsToSend = BigInt(Math.ceil((targetUsdc / 155.0) * 1e9 * 1.01));
    }

    settlementInstructions.push(
      SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: recipientPubkey,
        lamports: lamportsToSend,
      })
    );
  } else {
    // Determine token program (standard SPL or Token-2022)
    const mintAccountInfo = await connection.getAccountInfo(targetMintPubkey);
    const tokenProgramId = mintAccountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

    // Derive Associated Token Accounts (allowOwnerOffCurve = true for PDA/smart wallets)
    payerAta = getAssociatedTokenAddress(targetMintPubkey, payerPubkey, true, tokenProgramId);
    recipientAta = getAssociatedTokenAddress(targetMintPubkey, recipientPubkey, true, tokenProgramId);

    // 1. Ensure recipient's ATA exists (idempotent, safe if already initialized)
    settlementInstructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payerPubkey,
        recipientAta,
        recipientPubkey,
        targetMintPubkey,
        tokenProgramId
      )
    );

    // 2. Transfer exact USDC from payer's account to recipient
    settlementInstructions.push(
      createTransferCheckedInstruction(
        payerAta,
        targetMintPubkey,
        recipientAta,
        payerPubkey,
        targetAmountRaw,
        decimals,
        [],
        tokenProgramId
      )
    );
  }

  // 3. Memo instruction describing transaction
  const inputMeta = params.inputMint ? getTokenByMint(params.inputMint) : null;
  const memoText = params.intent.memo
    ? `Beam: ${params.intent.id} - ${params.intent.memo}`
    : isDevnet && params.inputMint && params.inputMint !== WSOL_MINT && !isDirectTokenSettlement
      ? `Beam [Devnet]: Pay with ${inputMeta?.symbol || 'Token'} -> Settle ${params.intent.targetAmount} USDC`
      : `Beam: ${params.intent.id} payment settlement`;

  settlementInstructions.push(
    new TransactionInstruction({
      keys: [{ pubkey: payerPubkey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  const latestBlockhash = await getLatestBlockhash();

  // CASE 1: Direct payment (Payer already paying in USDC)
  if (!params.swapTransactionBase64) {
    const messageV0 = new TransactionMessage({
      payerKey: payerPubkey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: settlementInstructions,
    }).compileToV0Message([]);

    const vTx = new VersionedTransaction(messageV0);
    const serialized = Buffer.from(vTx.serialize()).toString('base64');

    return {
      transactionBase64: serialized,
      recentBlockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      recipientAta: recipientAta ? recipientAta.toBase58() : recipientPubkey.toBase58(),
      payerAta: payerAta ? payerAta.toBase58() : payerPubkey.toBase58(),
      amountTransferredRaw: targetAmountRaw.toString(),
    };
  }

  // CASE 2: Atomic Swap + Settle (Decompile swap transaction and append settlement)
  const swapTxBuffer = Buffer.from(params.swapTransactionBase64, 'base64');
  const swapVTx = VersionedTransaction.deserialize(swapTxBuffer);

  // Fetch all Address Lookup Tables referenced by the aggregator swap
  const lookupTableAccounts: AddressLookupTableAccount[] = [];
  if (swapVTx.message.addressTableLookups && swapVTx.message.addressTableLookups.length > 0) {
    for (const lookup of swapVTx.message.addressTableLookups) {
      const altInfo = await connection.getAddressLookupTable(lookup.accountKey);
      if (altInfo.value) {
        lookupTableAccounts.push(altInfo.value);
      }
    }
  }

  // Decompile the swap transaction message into constituent instructions
  const decompiled = TransactionMessage.decompile(swapVTx.message, {
    addressLookupTableAccounts: lookupTableAccounts,
  });

  // Combine instructions: Aggregator Swap + Recipient Settle
  const combinedInstructions = [
    ...decompiled.instructions,
    ...settlementInstructions,
  ];

  // Recompile into a fresh Versioned Transaction with fresh blockhash
  const atomicMessage = new TransactionMessage({
    payerKey: payerPubkey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: combinedInstructions,
  }).compileToV0Message(lookupTableAccounts);

  const atomicTx = new VersionedTransaction(atomicMessage);
  const serialized = Buffer.from(atomicTx.serialize()).toString('base64');

  return {
    transactionBase64: serialized,
    recentBlockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    recipientAta: recipientAta ? recipientAta.toBase58() : recipientPubkey.toBase58(),
    payerAta: payerAta ? payerAta.toBase58() : payerPubkey.toBase58(),
    amountTransferredRaw: targetAmountRaw.toString(),
  };
}
