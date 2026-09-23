// Beam ⚡ Client Application

let connectedWallet = null;
let currentIntent = null;
let countdownTimer = null;
let currentQuote = null;
let isDemoMode = true;

// DOM Elements
const navCreateBtn = document.getElementById('navCreateBtn');
const navCheckoutBtn = document.getElementById('navCheckoutBtn');
const createView = document.getElementById('createView');
const checkoutView = document.getElementById('checkoutView');

const demoModeToggle = document.getElementById('demoModeToggle');
const demoModeLabel = document.getElementById('demoModeLabel');
const demoWalletBtn = document.getElementById('demoWalletBtn');
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletLabel = document.getElementById('walletLabel');

// Preset Buttons
const loadCoffeeDemoBtn = document.getElementById('loadCoffeeDemoBtn');
const loadInvoiceDemoBtn = document.getElementById('loadInvoiceDemoBtn');

// Create View Elements
const recipientWalletInput = document.getElementById('recipientWallet');
const useConnectedWalletBtn = document.getElementById('useConnectedWalletBtn');
const targetAmountInput = document.getElementById('targetAmount');
const expirySelect = document.getElementById('expirySelect');
const memoInput = document.getElementById('memo');
const generateLinkBtn = document.getElementById('generateLinkBtn');
const generatedLinkContainer = document.getElementById('generatedLinkContainer');
const shareableLinkInput = document.getElementById('shareableLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const openLinkBtn = document.getElementById('openLinkBtn');

// Checkout View Elements
const checkoutAmountDisplay = document.getElementById('checkoutAmountDisplay');
const checkoutMemoDisplay = document.getElementById('checkoutMemoDisplay');
const checkoutRecipientDisplay = document.getElementById('checkoutRecipientDisplay');
const checkoutExpiryDisplay = document.getElementById('checkoutExpiryDisplay');
const statusBadge = document.getElementById('statusBadge');
const paymentTokenSelect = document.getElementById('paymentTokenSelect');
const payerBalanceDisplay = document.getElementById('payerBalanceDisplay');
const quoteRequiredInput = document.getElementById('quoteRequiredInput');
const quoteTargetOutput = document.getElementById('quoteTargetOutput');
const payAndSettleBtn = document.getElementById('payAndSettleBtn');
const payBtnText = document.getElementById('payBtnText');
const receiptContainer = document.getElementById('receiptContainer');
const solscanLink = document.getElementById('solscanLink');

// --- Demo Mode Switcher ---
if (demoModeToggle) {
  demoModeToggle.addEventListener('change', () => {
    isDemoMode = demoModeToggle.checked;
    if (isDemoMode) {
      demoModeLabel.textContent = '🧪 Demo Mode';
      demoModeLabel.style.color = '#38bdf8';
    } else {
      demoModeLabel.textContent = '⚡ Live Mainnet';
      demoModeLabel.style.color = '#14F195';
    }
    updatePayButtonState();
  });
}

// --- Navigation ---
function switchView(view) {
  if (view === 'create') {
    createView.classList.remove('hidden');
    checkoutView.classList.add('hidden');
    navCreateBtn.classList.add('active');
    navCheckoutBtn.classList.remove('active');
  } else {
    createView.classList.add('hidden');
    checkoutView.classList.remove('hidden');
    navCreateBtn.classList.remove('active');
    navCheckoutBtn.classList.add('active');
  }
}

navCreateBtn.addEventListener('click', () => switchView('create'));
navCheckoutBtn.addEventListener('click', () => {
  switchView('checkout');
  if (!currentIntent) {
    loadPaymentIntent('demo-coffee');
  }
});

// --- Wallet Connection (Real & Demo) ---
async function connectWallet() {
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    // If no extension, offer demo wallet
    const useDemo = confirm(
      'No Solana wallet extension detected (Phantom/Solflare).\n\nWould you like to connect an instant simulated Demo Wallet with 5.4 SOL?'
    );
    if (useDemo) {
      connectDemoWallet();
    }
    return;
  }

  try {
    const resp = await provider.connect();
    connectedWallet = resp.publicKey.toString();
    walletLabel.textContent = `${connectedWallet.slice(0, 4)}...${connectedWallet.slice(-4)}`;
    connectWalletBtn.classList.add('wallet-connected');

    await refreshWalletBalances();
    updatePayButtonState();

    if (currentIntent) {
      await fetchQuote();
    }
  } catch (err) {
    console.error('Wallet connection failed:', err);
  }
}

function connectDemoWallet() {
  connectedWallet = '7Tar8QZTrRPwoGY5Ke9Vfwf6CmpBfekrNofERxgReza';
  walletLabel.textContent = '7Tar...Reza (Demo)';
  connectWalletBtn.classList.add('wallet-connected');
  payerBalanceDisplay.textContent = 'Balance: 5.4200 SOL (Simulated)';
  updatePayButtonState();
  if (currentIntent) {
    fetchQuote();
  }
}

if (demoWalletBtn) {
  demoWalletBtn.addEventListener('click', connectDemoWallet);
}
connectWalletBtn.addEventListener('click', connectWallet);

async function refreshWalletBalances() {
  if (!connectedWallet) return;
  if (connectedWallet === '7Tar8QZTrRPwoGY5Ke9Vfwf6CmpBfekrNofERxgReza') {
    payerBalanceDisplay.textContent = 'Balance: 5.4200 SOL (Demo)';
    return;
  }

  try {
    const res = await fetch(`/api/tokens/wallet/${connectedWallet}/balances`);
    if (!res.ok) return;
    const data = await res.json();

    const selectedMint = paymentTokenSelect.value;
    if (selectedMint.startsWith('So111111')) {
      payerBalanceDisplay.textContent = `Balance: ${data.solBalance.toFixed(4)} SOL`;
    } else {
      const match = data.tokens.find((t) => t.mint === selectedMint);
      payerBalanceDisplay.textContent = `Balance: ${match ? match.amount.toFixed(2) : '0.00'}`;
    }
  } catch (err) {
    console.warn('Failed to load wallet balances:', err);
  }
}

// --- Quick Presets ---
if (loadCoffeeDemoBtn) {
  loadCoffeeDemoBtn.addEventListener('click', () => {
    loadCoffeeDemoBtn.classList.add('active');
    if (loadInvoiceDemoBtn) loadInvoiceDemoBtn.classList.remove('active');
    loadPaymentIntent('demo-coffee');
  });
}

if (loadInvoiceDemoBtn) {
  loadInvoiceDemoBtn.addEventListener('click', () => {
    loadInvoiceDemoBtn.classList.add('active');
    if (loadCoffeeDemoBtn) loadCoffeeDemoBtn.classList.remove('active');
    loadPaymentIntent('demo-invoice');
  });
}

// --- Create Payment Link Flow ---
useConnectedWalletBtn.addEventListener('click', () => {
  if (connectedWallet) {
    recipientWalletInput.value = connectedWallet;
  } else {
    connectWallet();
  }
});

generateLinkBtn.addEventListener('click', async () => {
  const recipient = recipientWalletInput.value.trim();
  const amount = parseFloat(targetAmountInput.value);
  const expiresInMinutes = parseInt(expirySelect.value, 10);
  const memo = memoInput.value.trim();

  if (!recipient) {
    alert('Please enter a recipient Solana address');
    return;
  }
  if (!amount || amount <= 0) {
    alert('Please enter a valid target USDC amount');
    return;
  }

  generateLinkBtn.disabled = true;
  generateLinkBtn.textContent = 'Creating link...';

  try {
    const res = await fetch('/api/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient,
        targetAmount: amount,
        expiresInMinutes,
        memo: memo || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create payment intent');
    }

    const payUrl = `${window.location.origin}/pay/${data.intent.id}`;
    shareableLinkInput.value = payUrl;
    generatedLinkContainer.classList.remove('hidden');

    openLinkBtn.onclick = () => {
      loadPaymentIntent(data.intent.id);
      switchView('checkout');
    };
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    generateLinkBtn.disabled = false;
    generateLinkBtn.innerHTML = `<span>Create Beam Payment Link</span><span class="btn-arrow">→</span>`;
  }
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shareableLinkInput.value);
  copyLinkBtn.textContent = 'Copied!';
  setTimeout(() => (copyLinkBtn.textContent = 'Copy'), 2000);
});

// --- Checkout Flow ---
async function loadPaymentIntent(intentId) {
  try {
    const res = await fetch(`/api/intents/${intentId}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Intent not found');
    }

    const data = await res.json();
    currentIntent = data.intent;

    // Populate checkout UI
    checkoutAmountDisplay.textContent = currentIntent.targetAmount.toFixed(2);
    checkoutRecipientDisplay.textContent = `${currentIntent.recipient.slice(0, 6)}...${currentIntent.recipient.slice(-6)}`;
    quoteTargetOutput.textContent = `Exactly ${currentIntent.targetAmount.toFixed(2)} USDC`;

    if (currentIntent.memo) {
      checkoutMemoDisplay.textContent = `Memo: ${currentIntent.memo}`;
      checkoutMemoDisplay.classList.remove('hidden');
    } else {
      checkoutMemoDisplay.classList.add('hidden');
    }

    // Expiry timer
    startCountdown(data.timeLeftSeconds);

    // Update Status
    updateStatusPill(currentIntent.status);

    if (currentIntent.status === 'paid') {
      showPaidReceipt(currentIntent.paymentTxSignature);
    } else {
      receiptContainer.classList.add('hidden');
      await fetchQuote();
    }

    updatePayButtonState();
  } catch (err) {
    alert(`Could not load payment link: ${err.message}`);
  }
}

function updateStatusPill(status) {
  statusBadge.className = 'status-pill';
  if (status === 'paid') {
    statusBadge.classList.add('status-paid');
    statusBadge.textContent = 'Paid & Settled';
  } else if (status === 'expired') {
    statusBadge.classList.add('status-expired');
    statusBadge.textContent = 'Expired';
  } else {
    statusBadge.classList.add('status-ready');
    statusBadge.textContent = 'Awaiting Payment';
  }
}

function startCountdown(seconds) {
  if (countdownTimer) clearInterval(countdownTimer);
  let remaining = seconds;

  function tick() {
    if (remaining <= 0) {
      checkoutExpiryDisplay.textContent = 'Expired';
      updateStatusPill('expired');
      clearInterval(countdownTimer);
      return;
    }
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    checkoutExpiryDisplay.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    remaining--;
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

// Quote Fetcher
paymentTokenSelect.addEventListener('change', async () => {
  await refreshWalletBalances();
  await fetchQuote();
});

async function fetchQuote() {
  if (!currentIntent) return;

  const inputMint = paymentTokenSelect.value;
  quoteRequiredInput.textContent = 'Calculating optimal route...';

  try {
    const res = await fetch('/api/swap/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId: currentIntent.id,
        inputMint,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      quoteRequiredInput.textContent = `Quote error (${err.error})`;
      return;
    }

    const data = await res.json();
    currentQuote = data.quote;

    const sym = currentQuote.inputToken.symbol;
    const reqAmount = currentQuote.requiredInputAmount.toFixed(sym === 'SOL' ? 4 : 2);
    quoteRequiredInput.textContent = `~${reqAmount} ${sym}`;
  } catch (err) {
    quoteRequiredInput.textContent = 'Could not fetch quote';
  }
}

function updatePayButtonState() {
  if (!connectedWallet) {
    payBtnText.textContent = isDemoMode ? 'Connect or Use Demo Wallet' : 'Connect Wallet to Pay';
    payAndSettleBtn.disabled = false;
  } else if (currentIntent?.status === 'paid') {
    payBtnText.textContent = 'Payment Completed ✓';
    payAndSettleBtn.disabled = true;
  } else if (currentIntent?.status === 'expired') {
    payBtnText.textContent = 'Payment Link Expired';
    payAndSettleBtn.disabled = true;
  } else {
    payBtnText.textContent = isDemoMode
      ? `Simulate Pay & Settle ${currentIntent ? currentIntent.targetAmount.toFixed(2) : ''} USDC (Zero Cost)`
      : `Pay & Settle ${currentIntent ? currentIntent.targetAmount.toFixed(2) : ''} USDC`;
    payAndSettleBtn.disabled = false;
  }
}

// Pay and Settle Button Handler
payAndSettleBtn.addEventListener('click', async () => {
  if (!connectedWallet) {
    connectDemoWallet();
    return;
  }
  if (!currentIntent) return;

  payAndSettleBtn.disabled = true;

  try {
    const inputMint = paymentTokenSelect.value;

    // --- DEMO MODE SIMULATION FLOW (ZERO COST, ZERO TOKENS SPENT) ---
    if (isDemoMode) {
      payBtnText.textContent = '⚡ Building atomic v0 transaction...';
      await new Promise((r) => setTimeout(r, 600));

      payBtnText.textContent = '🧪 Simulating on Solana runtime...';
      await new Promise((r) => setTimeout(r, 800));

      payBtnText.textContent = 'Confirming settlement with RPC...';
      await new Promise((r) => setTimeout(r, 600));

      const mockSignature = `demo-sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const verifyRes = await fetch(`/api/intents/${currentIntent.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: mockSignature,
          payerWallet: connectedWallet,
        }),
      });

      const verifyData = await verifyRes.json();
      updateStatusPill('paid');
      showPaidReceipt(mockSignature);
      return;
    }

    // --- LIVE MAINNET REAL SIGNING FLOW ---
    payBtnText.textContent = 'Building atomic transaction...';

    const buildRes = await fetch('/api/swap/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intentId: currentIntent.id,
        payerPublicKey: connectedWallet,
        inputMint,
      }),
    });

    if (!buildRes.ok) {
      const err = await buildRes.json();
      throw new Error(err.error || 'Failed to assemble payment transaction');
    }

    const buildData = await buildRes.json();
    payBtnText.textContent = 'Please approve in Phantom...';

    const provider = window.solana || window.phantom?.solana;
    if (!provider) throw new Error('No Solana wallet detected');

    const binaryTx = Uint8Array.from(atob(buildData.transaction), (c) => c.charCodeAt(0));

    const { signature } = await provider.signAndSendTransaction({
      serialize: () => binaryTx,
    });

    payBtnText.textContent = 'Confirming on Solana...';

    const verifyRes = await fetch(`/api/intents/${currentIntent.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature,
        payerWallet: connectedWallet,
      }),
    });

    const verifyData = await verifyRes.json();
    if (verifyData.verified) {
      updateStatusPill('paid');
      showPaidReceipt(signature);
    } else {
      alert(`Payment submitted! Transaction signature: ${signature}. Awaiting final indexation.`);
      showPaidReceipt(signature);
    }
  } catch (err) {
    console.error('Payment error:', err);
    alert(`Payment failed: ${err.message}`);
    updatePayButtonState();
  }
});

function showPaidReceipt(signature) {
  receiptContainer.classList.remove('hidden');
  solscanLink.href = signature.startsWith('demo-')
    ? 'https://solscan.io'
    : `https://solscan.io/tx/${signature}`;
  updatePayButtonState();
}

// Initial Route Check
window.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  const payIndex = pathParts.indexOf('pay');
  const urlParams = new URLSearchParams(window.location.search);
  const intentId = (payIndex !== -1 && pathParts[payIndex + 1]) || urlParams.get('id');

  if (intentId) {
    switchView('checkout');
    loadPaymentIntent(intentId);
  } else {
    switchView('create');
  }
});
