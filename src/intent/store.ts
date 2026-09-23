import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { DATA_DIR, USDC_MINT, USDC_DECIMALS } from '../config.js';
import { getTokenByMint, toRawAmount } from '../core/tokens.js';
import type { PaymentIntent, CreatePaymentIntentInput, PaymentStatus } from './types.js';

const INTENTS_FILE = path.join(DATA_DIR, 'intents.json');

class PaymentIntentStore {
  private intents = new Map<string, PaymentIntent>();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(INTENTS_FILE)) {
        const raw = fs.readFileSync(INTENTS_FILE, 'utf-8');
        const list: PaymentIntent[] = JSON.parse(raw);
        for (const item of list) {
          this.intents.set(item.id, item);
        }
      }
      if (this.intents.size === 0) {
        this.preloadDemoIntents();
      }
    } catch (err) {
      console.warn('[intent-store] Failed to load intents from disk, starting empty:', err);
    }
    this.initialized = true;
  }

  private preloadDemoIntents(): void {
    const demoCoffee: PaymentIntent = {
      id: 'demo-coffee',
      recipient: '7Tar8QZTrRPwoGY5Ke9Vfwf6CmpBfekrNofERxgReza',
      targetMint: USDC_MINT,
      targetSymbol: 'USDC',
      targetAmount: 5.0,
      targetAmountRaw: '5000000',
      decimals: USDC_DECIMALS,
      memo: 'Artisan Iced Latte ☕',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: 'created',
    };

    const demoInvoice: PaymentIntent = {
      id: 'demo-invoice',
      recipient: '7Tar8QZTrRPwoGY5Ke9Vfwf6CmpBfekrNofERxgReza',
      targetMint: USDC_MINT,
      targetSymbol: 'USDC',
      targetAmount: 25.0,
      targetAmountRaw: '25000000',
      decimals: USDC_DECIMALS,
      memo: 'Web3 Dev Consultation #104 ⚡',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: 'created',
    };

    this.intents.set(demoCoffee.id, demoCoffee);
    this.intents.set(demoInvoice.id, demoInvoice);
    this.persist();
  }

  private persist(): void {
    try {
      const list = Array.from(this.intents.values());
      fs.writeFileSync(INTENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[intent-store] Failed to persist intents to disk:', err);
    }
  }

  public create(input: CreatePaymentIntentInput): PaymentIntent {
    const id = nanoid(10);
    const targetMint = input.targetMint || USDC_MINT;
    const token = getTokenByMint(targetMint);
    const decimals = token?.decimals ?? USDC_DECIMALS;
    const targetSymbol = token?.symbol ?? 'USDC';

    const now = Date.now();
    const expiryMinutes = input.expiresInMinutes || 60;
    const expiresAt = now + expiryMinutes * 60 * 1000;

    const rawAmount = toRawAmount(input.targetAmount, decimals);

    const intent: PaymentIntent = {
      id,
      recipient: input.recipient.trim(),
      targetMint,
      targetSymbol,
      targetAmount: input.targetAmount,
      targetAmountRaw: rawAmount.toString(),
      decimals,
      memo: input.memo?.trim() || undefined,
      createdAt: now,
      expiresAt,
      status: 'created',
    };

    this.intents.set(id, intent);
    this.persist();
    return intent;
  }

  public get(id: string): PaymentIntent | undefined {
    const intent = this.intents.get(id);
    if (!intent) return undefined;

    // Check expiration if not yet paid/failed
    if ((intent.status === 'created' || intent.status === 'pending') && Date.now() > intent.expiresAt) {
      intent.status = 'expired';
      this.persist();
    }

    return intent;
  }

  public updateStatus(
    id: string,
    status: PaymentStatus,
    details?: {
      payerWallet?: string;
      paymentTxSignature?: string;
      paidAmountRaw?: string;
    }
  ): PaymentIntent | undefined {
    const intent = this.intents.get(id);
    if (!intent) return undefined;

    intent.status = status;
    if (details?.payerWallet) intent.payerWallet = details.payerWallet;
    if (details?.paymentTxSignature) intent.paymentTxSignature = details.paymentTxSignature;
    if (details?.paidAmountRaw) intent.paidAmountRaw = details.paidAmountRaw;
    if (status === 'paid') intent.paidAt = Date.now();

    this.persist();
    return intent;
  }

  public listRecent(limit = 20): PaymentIntent[] {
    const all = Array.from(this.intents.values());
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all.slice(0, limit);
  }
}

export const intentStore = new PaymentIntentStore();
