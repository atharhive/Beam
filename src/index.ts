import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT, SOLANA_RPC_URL, SOLANA_NETWORK, VYBE_API_BASE } from './config.js';
import { intentRouter } from './routes/intent.routes.js';
import { swapRouter } from './routes/swap.routes.js';
import { tokenRouter } from './routes/token.routes.js';
import { verifyRouter } from './routes/verify.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.resolve(__dirname, '..', 'web');

const app = express();

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[beam] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
  }
  next();
});

// API Routes
app.use('/api/intents', intentRouter);
app.use('/api/intents', verifyRouter);
app.use('/api/swap', swapRouter);
app.use('/api/tokens', tokenRouter);

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Beam',
    version: '1.0.0',
    network: SOLANA_NETWORK,
    solanaRpc: SOLANA_RPC_URL,
    vybeBase: VYBE_API_BASE,
  });
});

// Serve frontend static assets
app.use(express.static(WEB_DIR));

// Direct links to payment routes fall through to the web app
app.get('/pay/:id', (_req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// Catch-all for SPA navigation
app.get('*', (_req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// Server listen
const server = app.listen(PORT, () => {
  console.log(`
  ⚡ Beam Server running at http://localhost:${PORT}
  🔗 API Health: http://localhost:${PORT}/api/health
  📡 Solana RPC: ${SOLANA_RPC_URL}
  🌐 Web UI: http://localhost:${PORT}
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

export default app;
