# Beam ⚡

> **Pay with anything. Settle in USDC.**

Beam is a non-custodial Solana payment-link protocol and dApp. Merchants and recipients specify an exact amount in USDC (e.g. `$10.00 USDC`), while payers can pay using any token in their Solana wallet (SOL, JUP, BONK, etc.). Beam atomically routes the swap through DEX aggregators and settles the exact requested USDC amount into the recipient's wallet in a single transaction.

---

## Key Features

- **Exact-Out Settlement**: Recipients receive the exact requested USDC amount guaranteed.
- **Pay With Any SPL Token**: Payers swap and pay seamlessly in one atomic transaction without manual pre-swaps.
- **Atomic Solana Versioned Transactions (v0)**: Swap and recipient transfer are composed in a single transaction—if anything fails, the entire transaction reverts.
- **Zero Custody**: Non-custodial, client-side signed via Phantom, Solflare, or any Solana wallet.
- **Instant On-Chain Verification**: Real-time RPC tracking of recipient balance changes and Solscan receipts.
- **Powered by Bun**: Fast execution, testing, and bundling.

---

## Architecture Overview

```
Payer (Holds SOL/BONK) ──► DEX Aggregator Swap (Vybe/Jupiter) ──► Recipient (Receives exact USDC)
                                      ▲
                         Atomic Versioned Transaction (v0)
```

---

## License

MIT © 2026 [atharhive](https://github.com/atharhive)
