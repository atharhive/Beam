# Beam ⚡

> **Pay with anything. Settle in USDC on Solana.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh)
[![Network: Solana](https://img.shields.io/badge/Network-Solana%20Mainnet-9945FF?logo=solana)](https://solana.com)

**Beam** is a non-custodial Solana payment-link protocol and dApp. Merchants and creators specify an exact amount in USDC (e.g. `$10.00 USDC`), while payers can check out using any token in their Solana wallet (SOL, JUP, BONK, RAY, etc.). 

Beam calculates the exact route via DEX aggregators and constructs a **single atomic Solana Versioned Transaction (v0)** that swaps the input token and transfers the exact requested USDC amount to the recipient. If anything slips or fails, the entire transaction reverts atomically—ensuring complete safety for both parties.

---

## The Problem & The Solution

* **The Problem**: Merchants and freelancers want stable, predictable revenue without token volatility (USDC). However, customers often hold SOL or other SPL tokens. Today, payers must manually go to an exchange, swap into USDC, pay extra fees, and send the payment—adding massive friction.
* **The Beam Solution**:
  1. Recipient creates a link: *"10 USDC to this address before 5:00 PM"*.
  2. Payer opens the link, connects Phantom or Solflare, and selects what token they want to pay with (e.g. SOL).
  3. Payer signs **one transaction**. The DEX swap occurs on-chain, and exactly 10 USDC lands in the merchant's wallet. Solscan confirms the receipt immediately.

---

## System Architecture

```
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────┐
│      Payer      │ ────► │  Atomic Transaction v0 │ ────► │     Recipient      │
│  (Holds SOL or  │       │ 1. Aggregator Swap     │       │  Receives exact    │
│   any SPL token)│       │ 2. Direct SPL Transfer │       │     10.00 USDC     │
└─────────────────┘       └────────────────────────┘       └────────────────────┘
```

### Key Technical Innovations
1. **Exact-Out Calculation with Slippage Buffer**: In Solana AMMs, prices fluctuate. Beam calculates the optimal input amount with a safe buffer, ensuring the minimum swap output covers the target USDC amount. Any surplus remains in the payer's wallet.
2. **Atomic Versioned Transaction (v0) Composition**: We decompile the DEX aggregator's versioned transaction message, append an idempotent recipient ATA creation instruction and a `createTransferCheckedInstruction`, and recompile with Address Lookup Tables (ALTs) and fresh blockhash.
3. **On-Chain Delta Verification**: The backend inspects Solana RPC parsed token balance changes to cryptographically verify that the recipient received `>= targetAmountRaw` USDC before marking the intent as `paid`.

---

## Quickstart (Powered by Bun)

### Prerequisites
- [Bun](https://bun.sh) (v1.2+)
- (Optional) Free Vybe Network API key from [vybe.fyi/api-pricing](https://vybe.fyi/api-pricing)
- (Optional) Helius or custom Solana RPC URL

### 1. Clone & Install
```bash
git clone git@github.com:atharhive/Beam.git
cd Beam
bun install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your optional RPC or Vybe keys
```

### 3. Run Development Server
```bash
bun run dev
```
Open **http://localhost:3000** in your browser.

### 4. Run Automated Test Suite
```bash
bun test
```

---

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/intents` | Create a new payment intent with recipient address, target USDC, and expiry. |
| `GET` | `/api/intents/:id` | Fetch intent status, expiration countdown, and payment details. |
| `POST` | `/api/swap/quote` | Calculate required input amount and route for a target USDC payment. |
| `POST` | `/api/swap/build` | Build an unsigned atomic Versioned Transaction (v0) ready for wallet signing. |
| `POST` | `/api/intents/:id/verify` | Verify on-chain settlement via Solana RPC and update status to `paid`. |
| `GET` | `/api/tokens` | List popular supported payment tokens (SOL, USDC, USDT, BONK, JUP, RAY). |
| `GET` | `/api/tokens/wallet/:address/balances` | Scan connected wallet's SOL and SPL token balances. |
| `GET` | `/api/health` | Service health check and RPC status. |

---

## How to Deliver an Outstanding Demo

1. **Preloaded Demo Links**: Beam comes preloaded with two demo payment links:
   - Coffee Order: `http://localhost:3000/pay/demo-coffee` ($5.00 USDC)
   - Consulting Invoice: `http://localhost:3000/pay/demo-invoice` ($25.00 USDC)
2. **Interactive Presentation Script**:
   - **Step 1 (Create)**: Open `http://localhost:3000`, click **Use Connected**, type `10` USDC, and click **Create Beam Payment Link**. Copy the link.
   - **Step 2 (Checkout)**: Open the link in a new tab or mobile browser. Notice the real-time expiration countdown and order details.
   - **Step 3 (Token Selection)**: Switch between **SOL**, **BONK**, or **JUP**. Point out how the route and required token amount update dynamically with slippage protection.
   - **Step 4 (Atomic Settle)**: Click **Pay & Settle**, approve in Phantom or Solflare. Within seconds, Solscan confirms the receipt!

---

## Deployment Guide

### Deploying on Railway or Render
1. Push your repository to GitHub (`git@github.com:atharhive/Beam.git`).
2. Create a new service on **Railway** or **Render** and link the repo.
3. Configure settings:
   - **Build Command**: `bun install`
   - **Start Command**: `bun src/index.ts`
4. Set Environment Variables:
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `SOLANA_RPC_URL`: Your Helius or QuickNode RPC URL
   - `VYBE_API_KEY`: Your Vybe API Key

---

## License

MIT © 2026 [atharhive](https://github.com/atharhive)
