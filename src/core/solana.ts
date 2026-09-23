import {
  Connection,
  PublicKey,
  type Commitment,
  type BlockhashWithExpiryBlockHeight,
  type SimulatedTransactionResponse,
  type VersionedTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { SOLANA_RPC_URL } from '../config.js';

let connectionInstance: Connection | null = null;

export function getSolanaConnection(commitment: Commitment = 'confirmed'): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(SOLANA_RPC_URL, {
      commitment,
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false,
    });
  }
  return connectionInstance;
}

/**
 * Fetch the latest blockhash with expiry height.
 */
export async function getLatestBlockhash(
  commitment: Commitment = 'confirmed'
): Promise<BlockhashWithExpiryBlockHeight> {
  const connection = getSolanaConnection(commitment);
  return await connection.getLatestBlockhash(commitment);
}

/**
 * Derive the Associated Token Account (ATA) for a wallet and mint.
 */
export function getAssociatedTokenAddress(
  mint: PublicKey | string,
  owner: PublicKey | string,
  allowOwnerOffCurve = false,
  programId = TOKEN_PROGRAM_ID
): PublicKey {
  const mintPubkey = typeof mint === 'string' ? new PublicKey(mint) : mint;
  const ownerPubkey = typeof owner === 'string' ? new PublicKey(owner) : owner;
  return getAssociatedTokenAddressSync(
    mintPubkey,
    ownerPubkey,
    allowOwnerOffCurve,
    programId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/**
 * Check if a token account exists on-chain and retrieve its token program if found.
 */
export async function checkTokenAccountExists(
  accountPubkey: PublicKey
): Promise<{ exists: boolean; programId?: PublicKey }> {
  const connection = getSolanaConnection();
  const info = await connection.getAccountInfo(accountPubkey, 'confirmed');
  if (!info) return { exists: false };

  const isSplToken = info.owner.equals(TOKEN_PROGRAM_ID);
  const isToken2022 = info.owner.equals(TOKEN_2022_PROGRAM_ID);

  return {
    exists: true,
    programId: isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
  };
}

/**
 * Simulate a versioned transaction before signing/broadcast.
 */
export async function simulateVersionedTransaction(
  transaction: VersionedTransaction
): Promise<SimulatedTransactionResponse> {
  const connection = getSolanaConnection();
  const simulation = await connection.simulateTransaction(transaction, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });

  if (simulation.value.err) {
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulation.value.err)} | Logs: ${simulation.value.logs?.slice(-5).join('; ')}`
    );
  }

  return simulation.value;
}
