import { EventEmitter } from 'events';
import { getBid } from '../agents/franchiseAgent.js';

export class AuctionOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.state = {
      phase: 'idle', // 'idle' | 'open' | 'bidding' | 'sold' | 'unsold' | 'complete'
      currentPlayer: null,
      currentHighBid: 0,
      currentHighBidder: null,
      timer: 0,
      playerQueue: [],
      soldPlayers: new Map(),
      franchises: new Map(),
      bidHistory: []
    };
    this.timerInterval = null;
  }

  initialize(playerPool, franchisesData) {
    this.state.playerQueue = [...playerPool];
    this.state.franchises.clear();
    this.state.soldPlayers.clear();
    
    franchisesData.forEach(f => {
      this.state.franchises.set(f.name, {
        name: f.name,
        budget: parseFloat(f.salary_cap_cr) || 120.0,
        roster: [],
        passCount: 0,
        personality: f.personality_type,
        targetGaps: ['BATTER', 'BOWLER', 'ALLROUNDER'] // Mocked initial gaps
      });
    });
    
    this.state.phase = 'open';
    this.emit('stateUpdated', this.getState());
  }

  startNextPlayer() {
    if (this.state.playerQueue.length === 0) {
      this.state.phase = 'complete';
      this.state.currentPlayer = null;
      this.emit('auctionComplete');
      this.emit('stateUpdated', this.getState());
      return;
    }

    this.state.currentPlayer = this.state.playerQueue.shift();
    this.state.currentHighBid = 0;
    this.state.currentHighBidder = null;
    this.state.bidHistory = [];
    this.state.phase = 'bidding';
    
    this._startTimer(15);
    this.emit('playerUp', this.state.currentPlayer);
    this.emit('stateUpdated', this.getState());
  }

  _startTimer(seconds) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.state.timer = seconds;
    this.emit('timerTick', this.state.timer);

    this.timerInterval = setInterval(() => {
      this.state.timer--;
      this.emit('timerTick', this.state.timer);

      if (this.state.timer <= 0) {
        clearInterval(this.timerInterval);
        this.endCurrentPlayer();
      }
    }, 1000);
  }

  submitBid(franchiseName, amount) {
    if (this.state.phase !== 'bidding' || !this.state.currentPlayer) return false;

    const franchise = this.state.franchises.get(franchiseName);
    if (!franchise) return false;

    // Rule: Franchise cannot bid if they already hold the high bid
    if (this.state.currentHighBidder === franchiseName) return false;

    // Rule: Minimum increment 0.25Cr
    let minBid = this.state.currentHighBid === 0 
      ? Number(this.state.currentPlayer.base_price_cr) 
      : this.state.currentHighBid + 0.25;
      
    // Allow precision errors by rounding
    minBid = Math.round(minBid * 4) / 4;
    let roundedAmount = Math.round(amount * 4) / 4;

    if (roundedAmount < minBid) return false;

    // Rule: Budget check
    if (franchise.budget < roundedAmount) return false;

    // Rule: Roster size cap (25 players max)
    if (franchise.roster.length >= 25) return false;

    // Rule: Overseas cap (8 players max)
    if (this.state.currentPlayer.nationality !== 'IND') {
      const overseasCount = franchise.roster.filter(p => p.nationality !== 'IND').length;
      if (overseasCount >= 8) return false;
    }

    // Accept Bid
    this.state.currentHighBid = roundedAmount;
    this.state.currentHighBidder = franchiseName;
    this.state.bidHistory.push({
      bidder: franchiseName,
      amount: roundedAmount,
      timestamp: Date.now()
    });

    // Reset 15s timer upon valid bid
    this._startTimer(15);
    this.emit('bidAccepted', { franchiseName, amount: roundedAmount });
    this.emit('stateUpdated', this.getState());

    return true;
  }

  async triggerAIRound() {
    if (this.state.phase !== 'bidding') return;

    // Randomize order of active AI franchises that can afford the next bid
    const activeFranchises = Array.from(this.state.franchises.values())
      .filter(f => {
        const nextMin = this.state.currentHighBid === 0 ? Number(this.state.currentPlayer.base_price_cr) : this.state.currentHighBid + 0.25;
        return f.name !== this.state.currentHighBidder && f.budget >= nextMin && f.roster.length < 25;
      })
      .sort(() => Math.random() - 0.5);

    for (const f of activeFranchises) {
      if (this.state.phase !== 'bidding') break;

      const franchiseConfig = {
        name: f.name,
        personality: f.personality,
        remainingBudget: f.budget,
        currentRoster: f.roster,
        targetGaps: f.targetGaps
      };

      const auctionStateForAgent = {
        currentPlayer: this.state.currentPlayer.name,
        currentHighBid: this.state.currentHighBid,
        currentHighBidder: this.state.currentHighBidder
      };

      const bidResult = await getBid(franchiseConfig, auctionStateForAgent, this.state.currentPlayer);

      if (bidResult.action === 'bid' && bidResult.amount) {
        const success = this.submitBid(f.name, bidResult.amount);
        if (success) {
           this.emit('aiCommentary', { franchise: f.name, action: 'bid', amount: bidResult.amount, commentary: bidResult.commentary });
           // We break so the auction advances sequentially rather than instantly resolving
           break; 
        }
      } else {
        this.emit('aiCommentary', { franchise: f.name, action: 'pass', commentary: bidResult.commentary });
      }
    }
  }

  endCurrentPlayer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.state.currentHighBidder) {
      // Sold Process
      const buyer = this.state.franchises.get(this.state.currentHighBidder);
      
      buyer.roster.push({
        ...this.state.currentPlayer,
        soldPrice: this.state.currentHighBid
      });

      // Deduct budget
      buyer.budget -= this.state.currentHighBid;

      this.state.soldPlayers.set(this.state.currentPlayer.name, {
        team: buyer.name,
        price: this.state.currentHighBid
      });

      this.state.phase = 'sold';
      this.emit('playerSold', { player: this.state.currentPlayer, buyer: buyer.name, price: this.state.currentHighBid });
    } else {
      // Unsold Process
      this.state.phase = 'unsold';
      this.emit('playerUnsold', this.state.currentPlayer);
    }

    this.emit('stateUpdated', this.getState());
  }

  getState() {
    // Return a strictly serializable snapshot (Maps converted)
    return {
      phase: this.state.phase,
      currentPlayer: this.state.currentPlayer,
      currentHighBid: this.state.currentHighBid,
      currentHighBidder: this.state.currentHighBidder,
      timer: this.state.timer,
      playerQueue: [...this.state.playerQueue],
      soldPlayers: Array.from(this.state.soldPlayers.entries()).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {}),
      franchises: Array.from(this.state.franchises.entries()).reduce((acc, [k, f]) => { 
        acc[k] = {
          name: f.name,
          budget: f.budget,
          roster: [...f.roster],
          passCount: f.passCount,
          personality: f.personality
        }; 
        return acc; 
      }, {}),
      bidHistory: [...this.state.bidHistory]
    };
  }
}
