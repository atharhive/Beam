// Beam ⚡ Client Application

let connectedWallet = null;
let currentIntent = null;
let countdownTimer = null;
let currentQuote = null;

// DOM Elements
const navCreateBtn = document.getElementById('navCreateBtn');
const navCheckoutBtn = document.getElementById('navCheckoutBtn');
const createView = document.getElementById('createView');
const checkoutView = document.getElementById('checkoutView');

const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletLabel = document.getElementById('walletLabel');
const walletChevron = document.getElementById('walletChevron');
const walletDropdown = document.getElementById('walletDropdown');
const walletDropdownAddress = document.getElementById('walletDropdownAddress');
const copyWalletAddressBtn = document.getElementById('copyWalletAddressBtn');
const copyWalletBtnText = document.getElementById('copyWalletBtnText');
const disconnectWalletBtn = document.getElementById('disconnectWalletBtn');

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
    const defaultId = new URLSearchParams(window.location.search).get('id');
    if (defaultId) loadPaymentIntent(defaultId);
  }
});

// --- Wallet Connection (Phantom / Solflare) ---
async function connectWallet() {
  const provider = window.solana || window.phantom?.solana;
  if (!provider) {
    alert('No Solana wallet detected. Please install Phantom or Solflare browser extension.');
    return;
  }

  try {
    const resp = await provider.connect();
    connectedWallet = resp.publicKey.toString();
    walletLabel.textContent = `${connectedWallet.slice(0, 4)}...${connectedWallet.slice(-4)}`;
    if (walletDropdownAddress) {
      walletDropdownAddress.textContent = connectedWallet;
    }
    connectWalletBtn.classList.add('wallet-connected');
    if (walletChevron) {
      walletChevron.classList.remove('hidden');
    }

    // Attach provider event listeners if supported
    if (provider.on && !provider._beamListenersBound) {
      provider.on('disconnect', () => disconnectWallet());
      provider.on('accountChanged', (publicKey) => {
        if (publicKey) {
          connectedWallet = publicKey.toString();
          walletLabel.textContent = `${connectedWallet.slice(0, 4)}...${connectedWallet.slice(-4)}`;
          if (walletDropdownAddress) {
            walletDropdownAddress.textContent = connectedWallet;
          }
          refreshWalletBalances();
          if (currentIntent) fetchQuote();
        } else {
          disconnectWallet();
        }
      });
      provider._beamListenersBound = true;
    }

    await refreshWalletBalances();
    updatePayButtonState();

    if (currentIntent) {
      await fetchQuote();
    }
  } catch (err) {
    console.error('Wallet connection failed:', err);
  }
}

async function disconnectWallet() {
  const provider = window.solana || window.phantom?.solana;
  if (provider && provider.disconnect) {
    try {
      await provider.disconnect();
    } catch (err) {
      console.warn('Provider disconnect error:', err);
    }
  }

  connectedWallet = null;
  walletLabel.textContent = 'Connect Wallet';
  connectWalletBtn.classList.remove('wallet-connected');
  if (walletChevron) {
    walletChevron.classList.add('hidden');
    walletChevron.classList.remove('open');
  }
  if (walletDropdown) {
    walletDropdown.classList.add('hidden');
  }
  if (payerBalanceDisplay) {
    payerBalanceDisplay.textContent = 'Balance: —';
  }

  updatePayButtonState();
}

connectWalletBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (connectedWallet) {
    walletDropdown.classList.toggle('hidden');
    walletChevron.classList.toggle('open');
  } else {
    connectWallet();
  }
});

disconnectWalletBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  disconnectWallet();
});

copyWalletAddressBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!connectedWallet) return;
  try {
    await navigator.clipboard.writeText(connectedWallet);
    copyWalletBtnText.textContent = 'Copied!';
    setTimeout(() => {
      copyWalletBtnText.textContent = 'Copy Address';
    }, 1500);
  } catch (err) {
    console.warn('Failed to copy address:', err);
  }
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (walletDropdown && !walletDropdown.classList.contains('hidden')) {
    if (!e.target.closest('.wallet-menu-wrapper')) {
      walletDropdown.classList.add('hidden');
      if (walletChevron) walletChevron.classList.remove('open');
    }
  }
});

async function refreshWalletBalances() {
  if (!connectedWallet) return;

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
    payBtnText.textContent = 'Connect Wallet to Pay';
    payAndSettleBtn.disabled = false;
  } else if (currentIntent?.status === 'paid') {
    payBtnText.textContent = 'Payment Completed ✓';
    payAndSettleBtn.disabled = true;
  } else if (currentIntent?.status === 'expired') {
    payBtnText.textContent = 'Payment Link Expired';
    payAndSettleBtn.disabled = true;
  } else {
    payBtnText.textContent = `Pay & Settle ${currentIntent ? currentIntent.targetAmount.toFixed(2) : ''} USDC`;
    payAndSettleBtn.disabled = false;
  }
}

// Pay and Settle Button Handler
payAndSettleBtn.addEventListener('click', async () => {
  if (!connectedWallet) {
    await connectWallet();
    return;
  }
  if (!currentIntent) return;

  payAndSettleBtn.disabled = true;
  payBtnText.textContent = 'Building atomic transaction...';

  try {
    const inputMint = paymentTokenSelect.value;

    // 1. Build atomic transaction from backend
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
    payBtnText.textContent = 'Please approve in wallet...';

    // 2. Client-side signing with Solana Wallet (Phantom / Solflare)
    const provider = window.solana || window.phantom?.solana;
    if (!provider) throw new Error('No Solana wallet detected');

    const binaryTx = Uint8Array.from(atob(buildData.transaction), (c) => c.charCodeAt(0));

    let txToSign = { serialize: () => binaryTx };
    if (window.solanaWeb3 && window.solanaWeb3.VersionedTransaction) {
      txToSign = window.solanaWeb3.VersionedTransaction.deserialize(binaryTx);
    }

    const { signature } = await provider.signAndSendTransaction(txToSign);

    payBtnText.textContent = 'Confirming on Solana...';

    // 3. Verify on-chain settlement
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
      showPaidReceipt(signature, verifyData.solscanUrl);
    } else {
      alert(`Payment submitted! Transaction signature: ${signature}. Awaiting final confirmation.`);
      showPaidReceipt(signature, verifyData.solscanUrl);
    }
  } catch (err) {
    console.error('Payment error:', err);
    alert(`Payment failed: ${err.message}`);
    updatePayButtonState();
  }
});

function showPaidReceipt(signature, solscanUrl) {
  receiptContainer.classList.remove('hidden');
  solscanLink.href = solscanUrl || `https://solscan.io/tx/${signature}?cluster=devnet`;
  updatePayButtonState();
}

async function initTokens() {
  try {
    const res = await fetch('/api/tokens');
    if (!res.ok) return;
    const data = await res.json();
    if (data.tokens && data.tokens.length > 0) {
      paymentTokenSelect.innerHTML = '';
      data.tokens.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.mint;
        opt.textContent = `${t.symbol} — ${t.name}`;
        paymentTokenSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn('Failed to load token list:', err);
  }
}

// Initial Route Check
window.addEventListener('DOMContentLoaded', async () => {
  await initTokens();

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
