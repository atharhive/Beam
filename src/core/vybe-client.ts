import {
  VYBE_API_BASE,
  getVybeApiKey,
  DEFAULT_SLIPPAGE_BPS,
} from '../config.js';

export interface SwapQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // Atomic integer string
  slippageBps?: number;
  router?: 'vybe' | 'jupiter' | 'titan';
}

export interface SwapRoutePlanStep {
  percent: number;
  inputMint: string;
  outputMint: string;
  protocol?: string;
  poolAddress?: string;
}

export interface VybeSwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: number;
  slippageBps: number;
  router: string;
  routePlan?: SwapRoutePlanStep[];
  feeEstimate?: {
    networkFeeLamports: number;
    protocolFeeTokens?: number;
  };
  rawQuote: Record<string, unknown>;
}

export interface BuildSwapTxParams {
  userPublicKey: string;
  quote: VybeSwapQuote;
  wrapAndUnwrapSol?: boolean;
  priorityFeeLamports?: number;
}

export interface BuildSwapTxResponse {
  swapTransaction: string; // Base64 serialized VersionedTransaction
  lastValidBlockHeight?: number;
  router: string;
}

/**
 * Fetch swap quote from Vybe DEX Aggregator.
 */
export async function fetchSwapQuote(params: SwapQuoteParams): Promise<VybeSwapQuote> {
  const apiKey = getVybeApiKey();
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const router = params.router ?? 'jupiter';

  const query = new URLSearchParams({
    inputMint: params.inputMint.trim(),
    outputMint: params.outputMint.trim(),
    amount: params.amount.trim(),
    slippageBps: String(slippageBps),
    router,
  });

  const url = `${VYBE_API_BASE}/v4/trading/swap-quote?${query.toString()}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vybe swap-quote failed (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = (await response.json()) as Record<string, any>;

  return {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    inAmount: String(data.inAmount || params.amount),
    outAmount: String(data.outAmount || '0'),
    priceImpactPct: data.priceImpactPct != null ? Number(data.priceImpactPct) : undefined,
    slippageBps,
    router,
    routePlan: data.routePlan,
    feeEstimate: {
      networkFeeLamports: 5000,
    },
    rawQuote: data,
  };
}

/**
 * Build unsigned Solana transaction from Vybe Aggregator.
 */
export async function buildSwapTransaction(params: BuildSwapTxParams): Promise<BuildSwapTxResponse> {
  const apiKey = getVybeApiKey();
  const url = `${VYBE_API_BASE}/v4/trading/swap`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const payload = {
    userPublicKey: params.userPublicKey.trim(),
    quoteResponse: params.quote.rawQuote,
    wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
    prioritizationFeeLamports: params.priorityFeeLamports ?? 10000,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Vybe swap build failed (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = (await response.json()) as { swapTransaction?: string; swapTx?: string };
  const swapTx = data.swapTransaction || data.swapTx;

  if (!swapTx) {
    throw new Error('Vybe API did not return a valid swapTransaction');
  }

  return {
    swapTransaction: swapTx,
    router: params.quote.router,
  };
}
