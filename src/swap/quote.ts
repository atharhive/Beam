import {
  USDC_MINT,
  DEFAULT_SLIPPAGE_BPS,
  EXACT_OUT_BUFFER_BPS,
} from '../config.js';
import { getTokenByMint, toRawAmount, toUiAmount, type TokenMeta } from '../core/tokens.js';
import { fetchSwapQuote, type VybeSwapQuote } from '../core/vybe-client.js';

export interface ExactOutPaymentQuoteParams {
  inputMint: string;
  targetOutputRaw: string;
  targetMint?: string;
  slippageBps?: number;
  router?: 'vybe' | 'jupiter' | 'titan';
}

export interface ExactOutPaymentQuoteResult {
  inputToken: TokenMeta;
  targetToken: TokenMeta;
  requiredInputAmount: number;
  requiredInputRaw: string;
  targetOutputAmount: number;
  targetOutputRaw: string;
  estimatedOutputAmount: number;
  estimatedOutputRaw: string;
  estimatedSurplusUsdc: number;
  isDirectTransfer: boolean;
  priceImpactPct?: number;
  slippageBps: number;
  dexQuote?: VybeSwapQuote;
}

/**
 * Calculate the exact payment quote needed to satisfy a target USDC amount.
 */
export async function calculateExactOutPaymentQuote(
  params: ExactOutPaymentQuoteParams
): Promise<ExactOutPaymentQuoteResult> {
  const targetMint = params.targetMint || USDC_MINT;
  const inputMint = params.inputMint.trim();
  const targetOutputRaw = BigInt(params.targetOutputRaw);
  const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

  const inputToken = getTokenByMint(inputMint) || {
    mint: inputMint,
    symbol: 'CUSTOM',
    name: 'Custom Token',
    decimals: 9,
  };

  const targetToken = getTokenByMint(targetMint) || {
    mint: targetMint,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  };

  const targetOutputAmount = toUiAmount(targetOutputRaw, targetToken.decimals);

  // If input token is already the target token (e.g. paying USDC for a USDC request)
  if (inputMint === targetMint) {
    return {
      inputToken,
      targetToken,
      requiredInputAmount: targetOutputAmount,
      requiredInputRaw: targetOutputRaw.toString(),
      targetOutputAmount,
      targetOutputRaw: targetOutputRaw.toString(),
      estimatedOutputAmount: targetOutputAmount,
      estimatedOutputRaw: targetOutputRaw.toString(),
      estimatedSurplusUsdc: 0,
      isDirectTransfer: true,
      slippageBps: 0,
    };
  }

  // Initial estimate: probe with 1 unit of input token to determine current exchange rate
  const probeUnitRaw = 10n ** BigInt(inputToken.decimals);
  const probeQuote = await fetchSwapQuote({
    inputMint,
    outputMint: targetMint,
    amount: probeUnitRaw.toString(),
    slippageBps,
    router: params.router,
  });

  const probeOutRaw = BigInt(probeQuote.outAmount);
  if (probeOutRaw <= 0n) {
    throw new Error(`No viable liquidity route found for ${inputToken.symbol} -> ${targetToken.symbol}`);
  }

  // Rate: output per 1 input token unit
  const rate = Number(probeOutRaw) / Number(probeUnitRaw);

  // Raw estimated input needed to reach target output
  const estimatedInputFloat = Number(targetOutputRaw) / rate;
  let estimatedInputRaw = BigInt(Math.ceil(estimatedInputFloat));

  // Add buffer (e.g. 1%) to protect against slippage and price movement so output >= targetOutputRaw
  const bufferMultiplier = 10000n + BigInt(EXACT_OUT_BUFFER_BPS);
  estimatedInputRaw = (estimatedInputRaw * bufferMultiplier) / 10000n;

  // Now fetch accurate quote with the buffered input amount
  const finalQuote = await fetchSwapQuote({
    inputMint,
    outputMint: targetMint,
    amount: estimatedInputRaw.toString(),
    slippageBps,
    router: params.router,
  });

  const finalOutRaw = BigInt(finalQuote.outAmount);

  // If even with buffer the output is lower than target, scale proportionally
  let finalInputRaw = estimatedInputRaw;
  if (finalOutRaw < targetOutputRaw) {
    const scaleFactor = Number(targetOutputRaw) / Number(finalOutRaw);
    finalInputRaw = BigInt(Math.ceil(Number(finalInputRaw) * scaleFactor * 1.005));
  }

  const requiredInputAmount = toUiAmount(finalInputRaw, inputToken.decimals);
  const estimatedOutputAmount = toUiAmount(finalQuote.outAmount, targetToken.decimals);
  const surplusRaw = BigInt(finalQuote.outAmount) > targetOutputRaw ? BigInt(finalQuote.outAmount) - targetOutputRaw : 0n;
  const estimatedSurplusUsdc = toUiAmount(surplusRaw, targetToken.decimals);

  return {
    inputToken,
    targetToken,
    requiredInputAmount,
    requiredInputRaw: finalInputRaw.toString(),
    targetOutputAmount,
    targetOutputRaw: targetOutputRaw.toString(),
    estimatedOutputAmount,
    estimatedOutputRaw: finalQuote.outAmount,
    estimatedSurplusUsdc,
    isDirectTransfer: false,
    priceImpactPct: finalQuote.priceImpactPct,
    slippageBps,
    dexQuote: finalQuote,
  };
}
