import { Router, type Request, type Response } from 'express';
import { CreatePaymentIntentSchema } from '../intent/schema.js';
import { intentStore } from '../intent/store.js';

export const intentRouter = Router();

/**
 * POST /api/intents
 * Create a new payment intent / link.
 */
intentRouter.post('/', (req: Request, res: Response) => {
  try {
    const parseResult = CreatePaymentIntentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
      return;
    }

    const intent = intentStore.create(parseResult.data);
    res.status(201).json({
      intent,
      payUrl: `/pay/${intent.id}`,
    });
  } catch (err: any) {
    console.error('[routes/intent] Error creating intent:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
});

/**
 * GET /api/intents/:id
 * Retrieve a payment intent by ID.
 */
intentRouter.get('/:id', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const intent = intentStore.get(id);

  if (!intent) {
    res.status(404).json({ error: `Payment intent '${id}' not found` });
    return;
  }

  const now = Date.now();
  const timeLeftSeconds = Math.max(0, Math.floor((intent.expiresAt - now) / 1000));

  res.json({
    intent,
    timeLeftSeconds,
    isExpired: intent.status === 'expired' || timeLeftSeconds === 0,
  });
});

/**
 * GET /api/intents
 * List recent payment intents.
 */
intentRouter.get('/', (_req: Request, res: Response) => {
  const intents = intentStore.listRecent(20);
  res.json({ intents });
});
