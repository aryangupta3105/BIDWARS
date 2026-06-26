import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getBid } from './agents/franchiseAgent.js';
import { getBidHeuristic } from './agents/heuristicAgent.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global state variables
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
  status: 'idle', // 'idle' | 'bidding' | 'sold' | 'unsold' | 'completed'
  biddingHistory: [], // Array of { franchise, action, amount, commentary }
  activeBidders: [], // Array of franchise names
  currentBidderIndex: 0,
  simulationMode: 'openai', // 'openai' | 'local'
  hasApiKey: false,
  userFranchise: null,
  awaitingUser: false
};

// Load data files
function loadInitialData() {
  try {
    const playersData = fs.readFileSync(path.join(__dirname, 'data', 'players.json'), 'utf8');
    players = JSON.parse(playersData);

    const franchisesData = fs.readFileSync(path.join(__dirname, 'data', 'franchises.json'), 'utf8');
    franchises = JSON.parse(franchisesData);
    
    state.hasApiKey = !!process.env.OPENAI_API_KEY;
    // Set default mode to local if API key is not present
    if (!state.hasApiKey) {
      state.simulationMode = 'local';
    }
  } catch (err) {
    console.error("Error loading initial data:", err);
  }
}

// Reset auction state
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

// Calculate the standard next bid increment in Lakhs
function getIncrement(currentBid) {
  if (currentBid < 50) return 2;
  if (currentBid < 200) return 5;
  if (currentBid < 500) return 10;
  return 20;
}

// REST Endpoints
app.get('/api/state', (req, res) => {
  res.json({
    ...state,
    franchises // Include full franchises roster and budget details
  });
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

// Single step of the auction state machine
app.post('/api/step', async (req, res) => {
  try {
    state.hasApiKey = !!process.env.OPENAI_API_KEY;
    
    // Case 1: Start a new player auction (when state is idle, sold, or unsold)
    if (state.status === 'idle' || state.status === 'sold' || state.status === 'unsold') {
      state.currentPlayerIndex++;
      
      // Check if we ran out of players
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
      
      // Determine active bidders (teams that can afford the base price)
      state.activeBidders = franchises
        .filter(f => f.remainingBudget >= nextPlayer.basePrice)
        .map(f => f.name);

      state.currentBidderIndex = 0;
      return res.json({ ...state, franchises });
    }

    // Case 2: Process bidding logic
    if (state.status === 'bidding') {
      // 1. Check if bidding is already resolved
      if (state.activeBidders.length === 0) {
        // No one bid on the player
        state.status = 'unsold';
        state.unsoldPlayers.push(state.currentPlayer.name);
        return res.json({ ...state, franchises });
      }

      if (state.activeBidders.length === 1 && state.currentHighBidder === state.activeBidders[0]) {
        // Player sold to the single active bidder who holds the high bid
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

      // 2. Identify the current bidder whose turn it is
      // Skip the current high bidder since they shouldn't bid against themselves
      while (state.activeBidders.length > 1 && state.activeBidders[state.currentBidderIndex] === state.currentHighBidder) {
        state.currentBidderIndex = (state.currentBidderIndex + 1) % state.activeBidders.length;
      }

      const bidderName = state.activeBidders[state.currentBidderIndex];
      const franchiseConfig = franchises.find(f => f.name === bidderName);
      
      // Determine the next bid amount
      const nextBid = state.currentHighBid === 0 ? state.currentPlayer.basePrice : state.currentHighBid + getIncrement(state.currentHighBid);

      // USER TURN INTERACTION AND PAUSE
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
          // Pass
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
        
        // Check if user pass/bid resolves bidding round immediately
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

      const auctionStateForAgent = {
        currentPlayer: state.currentPlayer.name,
        currentHighBid: state.currentHighBid,
        currentHighBidder: state.currentHighBidder,
        roundNumber: state.roundNumber
      };

      // Call the AI Agent (OpenAI or Heuristic)
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
          
          // Map back to Lakhs for server state
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
        // Simulate a brief thinking delay for heuristic/fallback agent to look realistic
        await new Promise(resolve => setTimeout(resolve, 800));
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
        
        // Move to the next bidder
        state.currentBidderIndex = (state.currentBidderIndex + 1) % state.activeBidders.length;
      } else {
        // Franchise passed, remove from active bidders
        state.biddingHistory.push({
          franchise: bidderName,
          action: 'pass',
          commentary: result.commentary
        });

        state.activeBidders.splice(state.currentBidderIndex, 1);
        
        // Adjust bidder index if it exceeds the new array bounds
        if (state.activeBidders.length > 0) {
          state.currentBidderIndex = state.currentBidderIndex % state.activeBidders.length;
        } else {
          state.currentBidderIndex = 0;
        }
      }

      // Double-check if this pass resolves the auction immediately
      if (state.activeBidders.length === 0 && !state.currentHighBidder) {
        state.status = 'unsold';
        state.unsoldPlayers.push(state.currentPlayer.name);
        state.roundNumber++;
      } else if (state.activeBidders.length === 1 && state.currentHighBidder === state.activeBidders[0]) {
        // Only one bidder left and they hold the high bid -> SOLD!
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
        // Bidders ran out but we have a high bidder (edge-case fail-safe)
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

// Run server initialization
loadInitialData();

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏏 IPL Auction Agent System running at: http://localhost:${PORT}`);
  console.log(`🤖 Mode: ${state.simulationMode} (API Key loaded: ${state.hasApiKey})`);
  console.log(`====================================================`);
});
