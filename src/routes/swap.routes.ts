import { Router, type Request, type Response } from 'express';
import { intentStore } from '../intent/store.js';
import { calculateExactOutPaymentQuote } from '../swap/quote.js';
import { composeAtomicPaymentTransaction } from '../swap/composer.js';
import { buildSwapTransaction } from '../core/vybe-client.js';

export const swapRouter = Router();

/**
 * POST /api/swap/quote
 * Calculate exact payment quote for a given intent and input token.
 */
swapRouter.post('/quote', async (req: Request, res: Response) => {
  try {
    const { intentId, inputMint, slippageBps, router } = req.body;

    if (!intentId || !inputMint) {
      res.status(400).json({ error: 'intentId and inputMint are required' });
      return;
    }

    const intent = intentStore.get(String(intentId));
    if (!intent) {
      res.status(404).json({ error: `Payment intent '${intentId}' not found` });
      return;
    }

    if (intent.status === 'expired' || intent.status === 'paid') {
      res.status(400).json({ error: `Cannot quote for intent with status '${intent.status}'` });
      return;
    }

    const quote = await calculateExactOutPaymentQuote({
      inputMint: String(inputMint),
      targetOutputRaw: intent.targetAmountRaw,
      targetMint: intent.targetMint,
      slippageBps: slippageBps ? Number(slippageBps) : undefined,
      router,
    });

    res.json({
      intentId: intent.id,
      quote,
    });
  } catch (err: any) {
    console.error('[routes/swap/quote] Error calculating quote:', err);
    res.status(500).json({ error: err.message || 'Failed to calculate payment quote' });
  }
});

/**
 * POST /api/swap/build
 * Build atomic versioned transaction for payment intent.
 */
swapRouter.post('/build', async (req: Request, res: Response) => {
  try {
    const { intentId, payerPublicKey, inputMint, slippageBps, router, priorityFeeLamports } = req.body;

    if (!intentId || !payerPublicKey || !inputMint) {
      res.status(400).json({ error: 'intentId, payerPublicKey, and inputMint are required' });
      return;
    }

    const intent = intentStore.get(String(intentId));
    if (!intent) {
      res.status(404).json({ error: `Payment intent '${intentId}' not found` });
      return;
    }

    if (intent.status === 'expired' || intent.status === 'paid') {
      res.status(400).json({ error: `Cannot build transaction for intent with status '${intent.status}'` });
      return;
    }

    // 1. Calculate exact-out quote
    const paymentQuote = await calculateExactOutPaymentQuote({
      inputMint: String(inputMint),
      targetOutputRaw: intent.targetAmountRaw,
      targetMint: intent.targetMint,
      slippageBps: slippageBps ? Number(slippageBps) : undefined,
      router,
    });

    let swapTxBase64: string | undefined;

    // 2. If swap is needed, ask aggregator to build DEX swap transaction
    if (!paymentQuote.isDirectTransfer && paymentQuote.dexQuote && paymentQuote.dexQuote.router !== 'simulated-dex') {
      try {
        const dexBuild = await buildSwapTransaction({
          userPublicKey: String(payerPublicKey),
          quote: paymentQuote.dexQuote,
          wrapAndUnwrapSol: true,
          priorityFeeLamports: priorityFeeLamports ? Number(priorityFeeLamports) : 10000,
        });
        swapTxBase64 = dexBuild.swapTransaction;
      } catch (dexErr) {
        console.warn('[swap/build] DEX aggregator build unavailable, using direct transaction fallback:', dexErr);
      }
    }

    // 3. Atomically compose the DEX swap with the recipient settlement
    const composed = await composeAtomicPaymentTransaction({
      payerPublicKey: String(payerPublicKey),
      intent,
      inputMint: String(inputMint),
      requiredInputRaw: paymentQuote.requiredInputRaw,
      swapTransactionBase64: swapTxBase64,
    });

    // Mark intent as pending
    intentStore.updateStatus(intent.id, 'pending', {
      payerWallet: String(payerPublicKey),
    });

    res.json({
      intentId: intent.id,
      transaction: composed.transactionBase64,
      recentBlockhash: composed.recentBlockhash,
      lastValidBlockHeight: composed.lastValidBlockHeight,
      requiredInputAmount: paymentQuote.requiredInputAmount,
      requiredInputRaw: paymentQuote.requiredInputRaw,
      inputToken: paymentQuote.inputToken,
      targetOutputAmount: paymentQuote.targetOutputAmount,
      isDirectTransfer: paymentQuote.isDirectTransfer,
    });
  } catch (err: any) {
    console.error('[routes/swap/build] Error building transaction:', err);
    res.status(500).json({ error: err.message || 'Failed to build payment transaction' });
  }
});
