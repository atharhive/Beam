import { Router, type Request, type Response } from 'express';
import { VerifyPaymentIntentSchema } from '../intent/schema.js';
import { verifyPaymentOnChain } from '../services/verifier.js';

export const verifyRouter = Router();

/**
 * POST /api/intents/:id/verify
 * Verify on-chain settlement for a payment intent.
 */
verifyRouter.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const parseResult = VerifyPaymentIntentSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
      return;
    }

    const { signature, payerWallet } = parseResult.data;
    const result = await verifyPaymentOnChain(id, signature, payerWallet);

    res.json(result);
  } catch (err: any) {
    console.error('[routes/verify] Error verifying payment:', err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});
