import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBid } from '../agents/franchiseAgent.js';
import { getBidHeuristic } from '../agents/heuristicAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// ───────────────── In-memory state ─────────────────
// NOTE: On Vercel serverless, state resets between cold-starts.
// This is fine for a demo/portfolio — each visitor gets a fresh auction.
let players = [];
let franchises = [];
let state = {
  currentPlayerIndex: -1,
  currentPlayer: null,
  currentHighBid: 0,
  currentHighBidder: null,
  roundNumber: 0,
  soldPlayers: [],
  unsoldPlayers: [],
  status: 'idle',
  biddingHistory: [],
  activeBidders: [],
  currentBidderIndex: 0,
  simulationMode: 'local',
  hasApiKey: false,
  userFranchise: null,
  awaitingUser: false
};

function loadInitialData() {
  try {
    const playersData = fs.readFileSync(path.join(__dirname, '..', 'data', 'players.json'), 'utf8');
    players = JSON.parse(playersData);

    const franchisesData = fs.readFileSync(path.join(__dirname, '..', 'data', 'franchises.json'), 'utf8');
    franchises = JSON.parse(franchisesData);

    state.hasApiKey = !!process.env.OPENAI_API_KEY;
    if (!state.hasApiKey) {
      state.simulationMode = 'local';
    }
  } catch (err) {
    console.error("Error loading initial data:", err);
  }
}

function resetAuction(mode = null) {
  loadInitialData();
  state.currentPlayerIndex = -1;
  state.currentPlayer = null;
  state.currentHighBid = 0;
  state.currentHighBidder = null;
  state.roundNumber = 1;
  state.soldPlayers = [];
  state.unsoldPlayers = [];
  state.status = 'idle';
  state.biddingHistory = [];
  state.activeBidders = [];
  state.currentBidderIndex = 0;
  state.userFranchise = state.userFranchise || null;
  state.awaitingUser = false;
  if (mode) {
    state.simulationMode = mode;
  } else {
    state.simulationMode = process.env.OPENAI_API_KEY ? 'openai' : 'local';
  }
}

function getIncrement(currentBid) {
  if (currentBid < 50) return 2;
  if (currentBid < 200) return 5;
  if (currentBid < 500) return 10;
  return 20;
}

// ───────────────── REST Endpoints ─────────────────

app.get('/api/state', (req, res) => {
  if (players.length === 0) loadInitialData();
  res.json({ ...state, franchises });
});

app.post('/api/reset', (req, res) => {
  const { mode } = req.body;
  resetAuction(mode);
  res.json({ success: true, state: { ...state, franchises } });
});

app.post('/api/toggle-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'openai' || mode === 'local') {
    state.simulationMode = mode;
    res.json({ success: true, mode: state.simulationMode });
  } else {
    res.status(400).json({ error: 'Invalid simulation mode' });
  }
});

app.post('/api/select-user-franchise', (req, res) => {
  const { franchise } = req.body;
  state.userFranchise = franchise || null;
  state.awaitingUser = false;
  res.json({ success: true, userFranchise: state.userFranchise });
});

app.post('/api/step', async (req, res) => {
  try {
    if (players.length === 0) loadInitialData();
    state.hasApiKey = !!process.env.OPENAI_API_KEY;

    // Case 1: Start a new player auction
    if (state.status === 'idle' || state.status === 'sold' || state.status === 'unsold') {
      state.currentPlayerIndex++;

      if (state.currentPlayerIndex >= players.length) {
        state.status = 'completed';
        state.currentPlayer = null;
        return res.json({ ...state, franchises });
      }

      const nextPlayer = players[state.currentPlayerIndex];
      state.currentPlayer = nextPlayer;
      state.currentHighBid = 0;
      state.currentHighBidder = null;
      state.biddingHistory = [];
      state.status = 'bidding';

      state.activeBidders = franchises
        .filter(f => f.remainingBudget >= nextPlayer.basePrice)
        .map(f => f.name);

      state.currentBidderIndex = 0;
      return res.json({ ...state, franchises });
    }

    // Case 2: Process bidding
    if (state.status === 'bidding') {
      if (state.activeBidders.length === 0) {
        state.status = 'unsold';
        state.unsoldPlayers.push(state.currentPlayer.name);
        return res.json({ ...state, franchises });
      }

      if (state.activeBidders.length === 1 && state.currentHighBidder === state.activeBidders[0]) {
        const winnerName = state.currentHighBidder;
        const winnerFranchise = franchises.find(f => f.name === winnerName);

        winnerFranchise.remainingBudget -= state.currentHighBid;
        winnerFranchise.currentRoster.push({
          name: state.currentPlayer.name,
          role: state.currentPlayer.role,
          price: state.currentHighBid,
          nationality: state.currentPlayer.nationality
        });

        state.soldPlayers.push({
          player: state.currentPlayer,
          price: state.currentHighBid,
          franchise: winnerName
        });

        state.status = 'sold';
        state.roundNumber++;
        return res.json({ ...state, franchises });
      }

      // Skip current high bidder
      while (state.activeBidders.length > 1 && state.activeBidders[state.currentBidderIndex] === state.currentHighBidder) {
        state.currentBidderIndex = (state.currentBidderIndex + 1) % state.activeBidders.length;
      }

      const bidderName = state.activeBidders[state.currentBidderIndex];
      const franchiseConfig = franchises.find(f => f.name === bidderName);
      const nextBid = state.currentHighBid === 0 ? state.currentPlayer.basePrice : state.currentHighBid + getIncrement(state.currentHighBid);

      // USER TURN
      if (state.userFranchise && bidderName === state.userFranchise) {
        const { userAction } = req.body;
        if (!userAction) {
          state.awaitingUser = true;
          return res.json({ ...state, franchises });
        }

        state.awaitingUser = false;
        if (userAction === 'bid') {
          state.currentHighBid = nextBid;
          state.currentHighBidder = bidderName;
          state.biddingHistory.push({
            franchise: bidderName,
            action: 'bid',
            amount: nextBid,
            commentary: "Placed a tactical manual bid! Challenging the other franchises."
          });
          state.currentBidderIndex = (state.currentBidderIndex + 1) % state.activeBidders.length;
        } else {
          state.biddingHistory.push({
            franchise: bidderName,
            action: 'pass',
            commentary: "Decided to pass on this player."
          });
          state.activeBidders.splice(state.currentBidderIndex, 1);
          if (state.activeBidders.length > 0) {
            state.currentBidderIndex = state.currentBidderIndex % state.activeBidders.length;
          } else {
            state.currentBidderIndex = 0;
          }
        }

        // Check resolution
        if (state.activeBidders.length === 0 && !state.currentHighBidder) {
          state.status = 'unsold';
          state.unsoldPlayers.push(state.currentPlayer.name);
          state.roundNumber++;
        } else if (state.activeBidders.length === 1 && state.currentHighBidder === state.activeBidders[0]) {
          const winnerName = state.currentHighBidder;
          const winnerFranchise = franchises.find(f => f.name === winnerName);
          winnerFranchise.remainingBudget -= state.currentHighBid;
          winnerFranchise.currentRoster.push({
            name: state.currentPlayer.name,
            role: state.currentPlayer.role,
            price: state.currentHighBid,
            nationality: state.currentPlayer.nationality
          });
          state.soldPlayers.push({
            player: state.currentPlayer,
            price: state.currentHighBid,
            franchise: winnerName
          });
          state.status = 'sold';
          state.roundNumber++;
        }

        return res.json({ ...state, franchises });
      }

      // AI AGENT TURN
      const auctionStateForAgent = {
        currentPlayer: state.currentPlayer.name,
        currentHighBid: state.currentHighBid,
        currentHighBidder: state.currentHighBidder,
        roundNumber: state.roundNumber
      };

      let result;
      let usingFallback = false;
      if (state.simulationMode === 'openai' && state.hasApiKey) {
        try {
          const configCr = {
            ...franchiseConfig,
            remainingBudget: franchiseConfig.remainingBudget / 100
          };
          const auctionStateCr = {
            ...auctionStateForAgent,
            currentHighBid: auctionStateForAgent.currentHighBid / 100
          };
          const playerCr = {
            ...state.currentPlayer,
            base_price_cr: state.currentPlayer.basePrice / 100
          };

          result = await getBid(configCr, auctionStateCr, playerCr);

          if (result.action === 'bid' && result.amount !== null) {
            result.amount = Math.round(result.amount * 100);
          }
        } catch (err) {
          console.warn(`OpenAI call for ${bidderName} failed: ${err.message}. Falling back to Heuristics.`);
          usingFallback = true;
        }
      }

      if (state.simulationMode === 'local' || !state.hasApiKey || usingFallback) {
        result = getBidHeuristic(franchiseConfig, auctionStateForAgent, state.currentPlayer);
        if (usingFallback && result.commentary) {
          result.commentary = `[Local fallback] ` + result.commentary;
        }
        // Brief thinking delay (shorter on serverless to avoid timeout)
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Process Agent action
      if (result.action === 'bid') {
        state.currentHighBid = nextBid;
        state.currentHighBidder = bidderName;
        state.biddingHistory.push({
          franchise: bidderName,
          action: 'bid',
          amount: nextBid,
          commentary: result.commentary
        });
        state.currentBidderIndex = (state.currentBidderIndex + 1) % state.activeBidders.length;
      } else {
        state.biddingHistory.push({
          franchise: bidderName,
          action: 'pass',
          commentary: result.commentary
        });
        state.activeBidders.splice(state.currentBidderIndex, 1);
        if (state.activeBidders.length > 0) {
          state.currentBidderIndex = state.currentBidderIndex % state.activeBidders.length;
        } else {
          state.currentBidderIndex = 0;
        }
      }

      // Check resolution
      if (state.activeBidders.length === 0 && !state.currentHighBidder) {
        state.status = 'unsold';
        state.unsoldPlayers.push(state.currentPlayer.name);
        state.roundNumber++;
      } else if (state.activeBidders.length === 1 && state.currentHighBidder === state.activeBidders[0]) {
        const winnerName = state.currentHighBidder;
        const winnerFranchise = franchises.find(f => f.name === winnerName);

        winnerFranchise.remainingBudget -= state.currentHighBid;
        winnerFranchise.currentRoster.push({
          name: state.currentPlayer.name,
          role: state.currentPlayer.role,
          price: state.currentHighBid,
          nationality: state.currentPlayer.nationality
        });

        state.soldPlayers.push({
          player: state.currentPlayer,
          price: state.currentHighBid,
          franchise: winnerName
        });

        state.status = 'sold';
        state.roundNumber++;
      } else if (state.activeBidders.length === 0 && state.currentHighBidder) {
        const winnerName = state.currentHighBidder;
        const winnerFranchise = franchises.find(f => f.name === winnerName);

        winnerFranchise.remainingBudget -= state.currentHighBid;
        winnerFranchise.currentRoster.push({
          name: state.currentPlayer.name,
          role: state.currentPlayer.role,
          price: state.currentHighBid,
          nationality: state.currentPlayer.nationality
        });

        state.soldPlayers.push({
          player: state.currentPlayer,
          price: state.currentHighBid,
          franchise: winnerName
        });

        state.status = 'sold';
        state.roundNumber++;
      }

      return res.json({ ...state, franchises });
    }

    res.json({ ...state, franchises });
  } catch (err) {
    console.error("Error in /api/step:", err);
    res.status(500).json({ error: err.message });
  }
});

// Initialize data on first import
loadInitialData();

// Export for Vercel serverless
export default app;
