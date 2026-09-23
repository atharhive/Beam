import { expect, test, describe } from 'bun:test';
import { intentStore } from '../src/intent/store.js';
import { CreatePaymentIntentSchema } from '../src/intent/schema.js';
import { USDC_MINT } from '../src/config.js';

const VALID_WALLET = '7Tar8QZTrRPwoGY5Ke9Vfwf6CmpBfekrNofERxgReza';

describe('PaymentIntent Schema & Store', () => {
  test('validates valid payment intent input', () => {
    const valid = CreatePaymentIntentSchema.safeParse({
      recipient: VALID_WALLET,
      targetAmount: 25.5,
      memo: 'Coffee & Donut',
      expiresInMinutes: 30,
    });
    expect(valid.success).toBe(true);
  });

  test('rejects invalid recipient address', () => {
    const invalid = CreatePaymentIntentSchema.safeParse({
      recipient: 'invalid-address-not-base58',
      targetAmount: 10,
    });
    expect(invalid.success).toBe(false);
  });

  test('rejects zero or negative amount', () => {
    const negative = CreatePaymentIntentSchema.safeParse({
      recipient: VALID_WALLET,
      targetAmount: -5,
    });
    expect(negative.success).toBe(false);

    const zero = CreatePaymentIntentSchema.safeParse({
      recipient: VALID_WALLET,
      targetAmount: 0,
    });
    expect(zero.success).toBe(false);
  });

  test('creates and retrieves payment intent', () => {
    const created = intentStore.create({
      recipient: VALID_WALLET,
      targetAmount: 10,
      targetMint: USDC_MINT,
      memo: 'Order #101',
      expiresInMinutes: 60,
    });

    expect(created.id).toBeDefined();
    expect(created.status).toBe('created');
    expect(created.targetAmount).toBe(10);
    expect(created.targetAmountRaw).toBe('10000000');
    expect(created.memo).toBe('Order #101');

    const fetched = intentStore.get(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(created.id);
  });

  test('updates intent status lifecycle', () => {
    const intent = intentStore.create({
      recipient: VALID_WALLET,
      targetAmount: 5,
    });

    const updated = intentStore.updateStatus(intent.id, 'paid', {
      payerWallet: '9UjwQHUVbJtgdYhBSSpzBF4z9mBwFkBoT2RJroGwwray',
      paymentTxSignature: '5J4...mock...sig',
      paidAmountRaw: '5000000',
    });

    expect(updated?.status).toBe('paid');
    expect(updated?.paidAt).toBeDefined();
    expect(updated?.payerWallet).toBe('9UjwQHUVbJtgdYhBSSpzBF4z9mBwFkBoT2RJroGwwray');
  });
});
