import { Router, type Request, type Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getAllSupportedTokens, getTokenByMint } from '../core/tokens.js';
import { getSolanaConnection } from '../core/solana.js';

export const tokenRouter = Router();

/**
 * GET /api/tokens
 * Return list of popular supported payment tokens.
 */
tokenRouter.get('/', (_req: Request, res: Response) => {
  const tokens = getAllSupportedTokens();
  res.json({ tokens });
});

/**
 * GET /api/tokens/:mint
 * Return metadata for a specific token mint.
 */
tokenRouter.get('/:mint', (req: Request, res: Response) => {
  const mint = String(req.params.mint);
  const token = getTokenByMint(mint);

  if (!token) {
    res.status(404).json({ error: `Token mint '${mint}' not found in registry` });
    return;
  }

  res.json({ token });
});

/**
 * GET /api/wallet/:address/balances
 * Fetch native SOL and SPL token balances for a connected wallet address.
 */
tokenRouter.get('/wallet/:address/balances', async (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    const pubkey = new PublicKey(address);
    const connection = getSolanaConnection();

    // 1. Fetch native SOL balance
    const solLamports = await connection.getBalance(pubkey);
    const solBalance = solLamports / 1e9;

    // 2. Fetch SPL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const tokens: Array<{
      mint: string;
      amount: number;
      amountRaw: string;
      decimals: number;
      symbol?: string;
    }> = [];

    for (const item of tokenAccounts.value) {
      const parsedInfo = item.account.data.parsed.info;
      const mint = parsedInfo.mint;
      const uiAmount = parsedInfo.tokenAmount.uiAmount || 0;
      const amountRaw = parsedInfo.tokenAmount.amount;
      const decimals = parsedInfo.tokenAmount.decimals;

      if (uiAmount > 0) {
        const known = getTokenByMint(mint);
        tokens.push({
          mint,
          amount: uiAmount,
          amountRaw,
          decimals,
          symbol: known?.symbol,
        });
      }
    }

    res.json({
      address,
      solLamports,
      solBalance,
      tokens,
    });
  } catch (err: any) {
    console.error('[routes/token] Error fetching wallet balances:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch balances' });
  }
});
