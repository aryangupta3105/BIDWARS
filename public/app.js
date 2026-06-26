// API URL base
const API_URL = '';

// App State
let appState = null;
let selectedFranchiseName = null;
let autoplayInterval = null;
let isStepping = false;
let visualTimerInterval = null;
const circumference = 2 * Math.PI * 42; // radius is 42, circumference is ~264
let lastStatus = null;
let activeTab = 'auction'; // 'auction' | 'squad'

// DOM Elements
const apiStatus = document.getElementById('api-status');
const apiText = document.getElementById('api-text');

const playerName = document.getElementById('player-name');
const playerRole = document.getElementById('player-role');
const playerNation = document.getElementById('player-nation');
const playerLastTeamVal = document.getElementById('player-last-team-val');
const playerHeadshot = document.getElementById('player-headshot');
const playerSet = document.getElementById('player-set');

// Stats Grid Elements
const statMatches = document.getElementById('stat-matches');
const statRuns = document.getElementById('stat-runs');
const statBatting = document.getElementById('stat-batting');
const playerBase = document.getElementById('player-base');

const currHighBid = document.getElementById('curr-high-bid');
const currHighBidder = document.getElementById('curr-high-bidder');
const nextBidTarget = document.getElementById('next-bid-target');

const btnStep = document.getElementById('btn-step');
const btnStepText = document.getElementById('btn-step-text');
const btnAutoplay = document.getElementById('btn-autoplay');
const btnAutoplayText = document.getElementById('btn-autoplay-text');
const btnReset = document.getElementById('btn-reset');
const selectMode = document.getElementById('select-mode');
const selectUserFranchise = document.getElementById('select-user-franchise');
const userBidPanel = document.getElementById('user-bid-panel');
const btnUserBid = document.getElementById('btn-user-bid');
const btnUserPass = document.getElementById('btn-user-pass');

const thinkingIndicator = document.getElementById('thinking-indicator');
const thinkingFranchise = document.getElementById('thinking-franchise');
const activeBiddersList = document.getElementById('active-bidders-list');
const biddingLog = document.getElementById('bidding-log');

const rosterTabs = document.getElementById('top-purses-list'); // mapped to purses list
const tabTeamName = document.getElementById('selected-tab-team-name');
const tabPersonality = document.getElementById('selected-tab-personality');
const tabBudget = document.getElementById('selected-tab-budget');
const tabBudgetPct = document.getElementById('selected-tab-budget-pct');
const tabBudgetBar = document.getElementById('selected-tab-budget-bar');
const tabRosterBody = document.getElementById('selected-tab-roster-body');

const newsMarquee = document.getElementById('news-marquee');

// Team names slug helper for styling classes
function getTeamSlug(name) {
  if (!name) return '';
  if (name.includes('Mumbai') || name === 'MI') return 'mi';
  if (name.includes('Chennai') || name === 'CSK') return 'csk';
  if (name.includes('Bengaluru') || name === 'RCB') return 'rcb';
  if (name.includes('Kolkata') || name === 'KKR') return 'kkr';
  if (name.includes('Delhi') || name === 'DC') return 'dc';
  if (name.includes('Punjab') || name === 'PBKS') return 'pbks';
  if (name.includes('Rajasthan') || name === 'RR') return 'rr';
  if (name.includes('Hyderabad') || name === 'SRH') return 'srh';
  if (name.includes('Gujarat') || name === 'GT') return 'gt';
  if (name.includes('Lucknow') || name === 'LSG') return 'lsg';
  return '';
}

// Color map for dynamic team swatches
const swatchColorMap = {
  mi: '#004BA0',
  csk: '#F9CD05',
  rcb: '#EC1C24',
  kkr: '#3A225D',
  dc: '#00008B',
  pbks: '#D71920',
  rr: '#E2007C',
  srh: '#F26522',
  gt: '#1C1C84',
  lsg: '#A72B2A'
};

// Format Lakhs into Crores/Lakhs string
function formatPrice(lakhs) {
  if (lakhs === null || lakhs === undefined) return '₹0 Lakhs';
  if (lakhs >= 100) {
    const crores = (lakhs / 100).toFixed(2);
    return `₹${crores} Cr`;
  }
  return `₹${lakhs} Lakhs`;
}

// Fetch and update global app state
async function fetchState() {
  try {
    const res = await fetch(`${API_URL}/api/state`);
    const data = await res.json();
    appState = data;
    updateUI();
  } catch (err) {
    console.error("Error fetching state:", err);
  }
}

// Initialize Application
async function init() {
  await fetchState();
  
  // Set initial selected tab to first franchise
  if (appState && appState.franchises && appState.franchises.length > 0) {
    selectedFranchiseName = appState.franchises[0].name;
  }
  
  updateUI();
  setupEventListeners();
  showTab('auction'); // Ensure live auction tab is active by default
}

// Tab Swapping Controller
function showTab(tabName) {
  activeTab = tabName;
  const navBtnAuction = document.getElementById('nav-btn-auction');
  const navBtnSquad = document.getElementById('nav-btn-squad');
  
  const panePlayerHero = document.getElementById('pane-player-hero');
  const paneStage = document.getElementById('pane-stage');
  const paneSquadManager = document.getElementById('pane-squad-manager');
  
  if (tabName === 'auction') {
    if (navBtnAuction) navBtnAuction.className = "flex items-center gap-3 w-full bg-surface-raised text-primary border-l-4 border-primary px-4 py-3 transition-all duration-200 ease-in-out";
    if (navBtnSquad) navBtnSquad.className = "flex items-center gap-3 w-full text-on-surface-variant px-4 py-3 hover:bg-surface-raised hover:text-on-surface transition-all duration-200 ease-in-out border-l-4 border-transparent";
    
    if (panePlayerHero) panePlayerHero.classList.remove('hidden');
    if (paneStage) paneStage.classList.remove('hidden');
    if (paneSquadManager) paneSquadManager.classList.add('hidden');
  } else {
    if (navBtnAuction) navBtnAuction.className = "flex items-center gap-3 w-full text-on-surface-variant px-4 py-3 hover:bg-surface-raised hover:text-on-surface transition-all duration-200 ease-in-out border-l-4 border-transparent";
    if (navBtnSquad) navBtnSquad.className = "flex items-center gap-3 w-full bg-surface-raised text-primary border-l-4 border-primary px-4 py-3 transition-all duration-200 ease-in-out";
    
    if (panePlayerHero) panePlayerHero.classList.add('hidden');
    if (paneStage) paneStage.classList.add('hidden');
    if (paneSquadManager) paneSquadManager.classList.remove('hidden');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  btnStep.addEventListener('click', handleStep);
  btnAutoplay.addEventListener('click', toggleAutoplay);
  btnReset.addEventListener('click', handleReset);
  selectMode.addEventListener('change', handleModeChange);
  selectUserFranchise.addEventListener('change', handleUserFranchiseChange);
  btnUserBid.addEventListener('click', () => handleUserAction('bid'));
  btnUserPass.addEventListener('click', () => handleUserAction('pass'));

  // Tab switcher buttons
  const navBtnAuction = document.getElementById('nav-btn-auction');
  const navBtnSquad = document.getElementById('nav-btn-squad');
  if (navBtnAuction) navBtnAuction.addEventListener('click', () => showTab('auction'));
  if (navBtnSquad) navBtnSquad.addEventListener('click', () => showTab('squad'));
}

async function handleUserFranchiseChange() {
  const franchise = selectUserFranchise.value;
  try {
    const res = await fetch(`${API_URL}/api/select-user-franchise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ franchise })
    });
    const data = await res.json();
    if (data.success) {
      if (!appState) appState = {};
      appState.userFranchise = data.userFranchise;
      if (data.userFranchise) {
        selectedFranchiseName = data.userFranchise;
      }
      updateUI();
    }
  } catch (err) {
    console.error("Error setting user franchise:", err);
  }
}

async function handleUserAction(action) {
  if (isStepping) return;
  isStepping = true;
  btnUserBid.disabled = true;
  btnUserPass.disabled = true;

  try {
    const res = await fetch(`${API_URL}/api/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAction: action })
    });
    const data = await res.json();
    appState = data;
    updateUI();

    if (appState.status === 'bidding') {
      startVisualTimer();
    }
  } catch (err) {
    console.error("Error performing user action:", err);
  } finally {
    isStepping = false;
    btnUserBid.disabled = false;
    btnUserPass.disabled = false;
  }
}

// Start Visual Timer Animation
function startVisualTimer() {
  if (visualTimerInterval) clearInterval(visualTimerInterval);
  
  const timerCircle = document.getElementById('timerCircle');
  if (!timerCircle) return;
  
  let duration = 1800; // matches autoplay interval
  let elapsed = 0;
  
  timerCircle.style.strokeDashoffset = '0';
  
  visualTimerInterval = setInterval(() => {
    elapsed += 40;
    
    let offset = (elapsed / duration) * circumference;
    timerCircle.style.strokeDashoffset = Math.min(circumference, offset);
    
    let secondsLeft = Math.ceil((duration - elapsed) / (duration / 15));
    if (secondsLeft < 0) secondsLeft = 0;
    const timerCircleText = document.getElementById('timerCircleText');
    if (timerCircleText) {
      timerCircleText.textContent = secondsLeft;
      
      // Update color based on urgency
      if (secondsLeft > 8) {
        timerCircle.style.stroke = '#00C787'; // timer-safe
        timerCircleText.style.color = '#00C787';
      } else if (secondsLeft > 4) {
        timerCircle.style.stroke = '#FF8C00'; // timer-warn
        timerCircleText.style.color = '#FF8C00';
      } else {
        timerCircle.style.stroke = '#FF3B3B'; // danger
        timerCircleText.style.color = '#FF3B3B';
      }
    }
    
    if (elapsed >= duration) {
      clearInterval(visualTimerInterval);
    }
  }, 40);
}

// Handle Single Step Action
async function handleStep() {
  if (isStepping) return;
  isStepping = true;
  btnStep.disabled = true;

  // Show thinking indicator if currently bidding
  if (appState && appState.status === 'bidding') {
    const nextBidder = appState.activeBidders[appState.currentBidderIndex];
    if (nextBidder && thinkingIndicator && thinkingFranchise) {
      thinkingFranchise.textContent = `${nextBidder} evaluating bid...`;
      thinkingIndicator.classList.remove('hidden');
    }
  }

  try {
    const res = await fetch(`${API_URL}/api/step`, { method: 'POST' });
    const data = await res.json();
    
    appState = data;
    updateUI();
    
    // Start countdown visual sweep when in active bidding
    if (appState.status === 'bidding') {
      startVisualTimer();
    }
    
  } catch (err) {
    console.error("Error performing step:", err);
  } finally {
    if (thinkingIndicator) thinkingIndicator.classList.add('hidden');
    isStepping = false;
    btnStep.disabled = false;
  }
}

// Toggle Autoplay
function toggleAutoplay() {
  if (autoplayInterval) {
    // Stop autoplay
    clearInterval(autoplayInterval);
    autoplayInterval = null;
    btnAutoplay.classList.remove('bg-primary');
    btnAutoplay.classList.add('bg-white/10');
    btnAutoplayText.textContent = 'Auto';
    btnAutoplay.querySelector('.btn-icon').textContent = '▶';
    
    if (visualTimerInterval) {
      clearInterval(visualTimerInterval);
      visualTimerInterval = null;
    }
  } else {
    // Start autoplay
    btnAutoplay.classList.remove('bg-white/10');
    btnAutoplay.classList.add('bg-primary');
    btnAutoplayText.textContent = 'Pause';
    btnAutoplay.querySelector('.btn-icon').textContent = '⏸';
    
    // Trigger first step immediately
    handleStep();
    
    autoplayInterval = setInterval(async () => {
      if (isStepping) return;
      
      // Stop loop if auction completes
      if (appState && appState.status === 'completed') {
        toggleAutoplay();
        return;
      }
      
      await handleStep();
    }, 1800);
  }
}

// Reset Auction
async function handleReset() {
  if (confirm("Are you sure you want to reset the entire auction? All rosters and budgets will be reset.")) {
    if (autoplayInterval) toggleAutoplay();
    try {
      const res = await fetch(`${API_URL}/api/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectMode.value })
      });
      const data = await res.json();
      appState = data.state;
      
      // Clear logs manually
      if (biddingLog) {
        biddingLog.innerHTML = `
          <div class="log-empty-state">
            <p>Start the auction to see live franchise bidding wars, analytical commentary, and strategic moves.</p>
          </div>`;
      }
        
      updateUI();
    } catch (err) {
      console.error("Error resetting auction:", err);
    }
  }
}

// Mode Selection Change
async function handleModeChange() {
  const newMode = selectMode.value;
  try {
    const res = await fetch(`${API_URL}/api/toggle-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    });
    const data = await res.json();
    if (data.success) {
      appState.simulationMode = data.mode;
      updateUI();
    }
  } catch (err) {
    console.error("Error updating mode:", err);
  }
}

// Highlight the active Lot category in the TopNavBar tabs
function updateCategoryTabs() {
  const tabCapped = document.getElementById('tab-capped');
  const tabUncapped = document.getElementById('tab-uncapped');
  const tabOverseas = document.getElementById('tab-overseas');
  if (!tabCapped || !tabUncapped || !tabOverseas) return;

  const resetTab = (tab) => {
    tab.className = "h-full px-4 flex items-center justify-center font-label-caps text-label-caps text-on-surface-variant hover:bg-surface-raised transition-colors border-b-2 border-transparent";
  };
  resetTab(tabCapped);
  resetTab(tabUncapped);
  resetTab(tabOverseas);

  if (appState && appState.currentPlayer) {
    const p = appState.currentPlayer;
    if (p.nationality === 'Overseas') {
      tabOverseas.className = "h-full px-4 flex items-center justify-center font-label-caps text-label-caps text-primary border-b-2 border-primary font-bold bg-surface-container-low transition-colors";
    } else if (p.basePrice < 50) {
      tabUncapped.className = "h-full px-4 flex items-center justify-center font-label-caps text-label-caps text-primary border-b-2 border-primary font-bold bg-surface-container-low transition-colors";
    } else {
      tabCapped.className = "h-full px-4 flex items-center justify-center font-label-caps text-label-caps text-primary border-b-2 border-primary font-bold bg-surface-container-low transition-colors";
    }
  } else {
    tabCapped.className = "h-full px-4 flex items-center justify-center font-label-caps text-label-caps text-primary border-b-2 border-primary font-bold bg-surface-container-low transition-colors";
  }
}

// Render dynamic elements based on state
function updateUI() {
  if (!appState) return;

  // 1. Update Header/API status
  if (selectMode) selectMode.value = appState.simulationMode;
  
  if (apiStatus && apiText) {
    if (appState.hasApiKey) {
      apiStatus.classList.remove('border-red-500/20', 'text-error');
      apiStatus.classList.add('border-primary/20', 'text-primary');
      const indicator = apiStatus.querySelector('.status-indicator');
      if (indicator) {
        indicator.classList.remove('bg-red-500');
        indicator.classList.add('bg-tertiary');
      }
      apiText.textContent = 'API Key: Loaded';
    } else {
      apiStatus.classList.remove('border-primary/20', 'text-primary');
      apiStatus.classList.add('border-red-500/20', 'text-error');
      const indicator = apiStatus.querySelector('.status-indicator');
      if (indicator) {
        indicator.classList.remove('bg-tertiary');
        indicator.classList.add('bg-red-500');
      }
      apiText.textContent = 'API Key: Missing';
      
      // Disable OpenAI mode if key is missing
      if (selectMode && selectMode.value === 'openai') {
        selectMode.value = 'local';
      }
    }
  }

  // 2. Render Player Info
  if (appState.currentPlayer) {
    const p = appState.currentPlayer;
    if (playerName) playerName.textContent = p.name;
    if (playerRole) playerRole.textContent = p.role;
    if (playerNation) playerNation.textContent = p.nationality.toUpperCase();
    if (playerLastTeamVal) {
      playerLastTeamVal.textContent = p.lastTeam || 'N/A';
      playerLastTeamVal.className = `px-2 py-0.5 rounded bg-surface-raised border border-border-default font-label-caps text-label-caps text-[9px] uppercase font-bold text-${getTeamSlug(p.lastTeam)}`;
    }
    if (playerSet) {
      playerSet.textContent = `Set ${appState.roundNumber} · ${p.basePrice >= 150 ? 'Marquee' : 'Tier 1'}`;
    }
    
    // Adjust stats labels dynamically based on role
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      if (p.role === 'Bowler') {
        statsGrid.innerHTML = `
          <div class="flex flex-col">
            <span id="stat-matches-label" class="font-label-caps text-label-caps text-on-surface-variant text-[10px]">WICKETS</span>
            <span id="stat-matches" class="font-stat-value text-stat-value text-primary font-bold">${p.stats.wickets || '-'}</span>
          </div>
          <div class="flex flex-col border-l border-r border-border-default">
            <span id="stat-runs-label" class="font-label-caps text-label-caps text-on-surface-variant text-[10px]">ECONOMY</span>
            <span id="stat-runs" class="font-stat-value text-stat-value text-primary font-bold">${p.stats.economy ? p.stats.economy.toFixed(2) : '-'}</span>
          </div>
          <div class="flex flex-col">
            <span id="stat-batting-label" class="font-label-caps text-label-caps text-on-surface-variant text-[10px]">MATCHES</span>
            <span id="stat-batting" class="font-stat-value text-stat-value text-primary font-bold">${p.stats.matches || '-'}</span>
          </div>
        `;
      } else {
        statsGrid.innerHTML = `
          <div class="flex flex-col">
            <span id="stat-matches-label" class="font-label-caps text-label-caps text-on-surface-variant text-[10px]">RUNS</span>
            <span id="stat-matches" class="font-stat-value text-stat-value text-primary font-bold">${p.stats.runs || '-'}</span>
          </div>
          <div class="flex flex-col border-l border-r border-border-default">
            <span id="stat-runs-label" class="font-label-caps text-label-caps text-on-surface-variant text-[10px]">AVERAGE</span>
            <span id="stat-runs" class="font-stat-value text-stat-value text-primary font-bold">${p.stats.avg ? p.stats.avg.toFixed(1) : '-'}</span>
          </div>
          <div class="flex flex-col">
            <span id="stat-batting-label" class="font-label-caps text-label-caps text-on-surface-variant text-[10px]">STRIKE RATE</span>
            <span id="stat-batting" class="font-stat-value text-stat-value text-primary font-bold">${p.stats.sr ? p.stats.sr.toFixed(1) : '-'}</span>
          </div>
        `;
      }
    }
    
    if (playerBase) playerBase.textContent = `Base Price: ${formatPrice(p.basePrice)}`;
    
    // Bidding info
    if (currHighBid) {
      currHighBid.textContent = appState.currentHighBid > 0 ? formatPrice(appState.currentHighBid) : formatPrice(p.basePrice);
    }
    
    // Update current leader display
    const leaderLogo = document.getElementById('curr-high-bidder-logo');
    const leaderPing = document.getElementById('curr-high-bidder-ping');
    const leaderName = document.getElementById('curr-high-bidder');
    
    if (appState.currentHighBidder) {
      const slug = getTeamSlug(appState.currentHighBidder);
      const color = swatchColorMap[slug] || '#475569';
      
      if (leaderLogo) {
        leaderLogo.textContent = slug.toUpperCase();
        leaderLogo.style.backgroundColor = color;
        leaderLogo.style.borderColor = color;
      }
      if (leaderPing) {
        leaderPing.style.backgroundColor = color;
        leaderPing.classList.remove('hidden');
      }
      if (leaderName) {
        leaderName.textContent = appState.currentHighBidder;
        leaderName.style.color = color;
      }
    } else {
      if (leaderLogo) {
        leaderLogo.textContent = "-";
        leaderLogo.style.backgroundColor = '#475569';
        leaderLogo.style.borderColor = '#334155';
      }
      if (leaderPing) {
        leaderPing.classList.add('hidden');
      }
      if (leaderName) {
        leaderName.textContent = 'Awaiting Opening Bid';
        leaderName.style.color = '#94a3b8';
      }
    }

    // Next bid increment calculation
    let nextBidVal = p.basePrice;
    if (appState.currentHighBid > 0) {
      let increment = 2; // default 2 Lakhs
      const cb = appState.currentHighBid;
      if (cb >= 50) increment = 5;
      if (cb >= 200) increment = 10;
      if (cb >= 500) increment = 20;
      nextBidVal = cb + increment;
    }
    if (nextBidTarget) nextBidTarget.textContent = formatPrice(nextBidVal);
  } else {
    // No active player
    const leaderLogo = document.getElementById('curr-high-bidder-logo');
    const leaderPing = document.getElementById('curr-high-bidder-ping');
    const leaderName = document.getElementById('curr-high-bidder');
    
    if (leaderLogo) {
      leaderLogo.textContent = "-";
      leaderLogo.style.backgroundColor = '#475569';
      leaderLogo.style.borderColor = '#334155';
    }
    if (leaderPing) {
      leaderPing.classList.add('hidden');
    }
    
    if (appState.status === 'completed') {
      if (playerName) playerName.textContent = "Auction Finished!";
      if (playerRole) playerRole.textContent = "--";
      if (playerNation) playerNation.textContent = "--";
      if (playerLastTeamVal) {
        playerLastTeamVal.textContent = "--";
        playerLastTeamVal.className = "px-2 py-0.5 rounded bg-surface-raised border border-border-default font-label-caps text-label-caps text-[9px] uppercase font-bold text-white";
      }
      if (currHighBid) currHighBid.textContent = "-";
      if (leaderName) leaderName.textContent = "FINISHED";
      if (nextBidTarget) nextBidTarget.textContent = "-";
      if (playerBase) playerBase.textContent = "-";
    } else {
      if (playerName) playerName.textContent = "Start Bidding Process";
      if (playerRole) playerRole.textContent = "--";
      if (playerNation) playerNation.textContent = "--";
      if (playerLastTeamVal) {
        playerLastTeamVal.textContent = "--";
        playerLastTeamVal.className = "px-2 py-0.5 rounded bg-surface-raised border border-border-default font-label-caps text-label-caps text-[9px] uppercase font-bold text-white";
      }
      if (currHighBid) currHighBid.textContent = "-";
      if (leaderName) leaderName.textContent = "NOT STARTED";
      if (nextBidTarget) nextBidTarget.textContent = "-";
      if (playerBase) playerBase.textContent = "-";
    }
  }

  // Adjust button labels based on status
  if (appState.status === 'idle' || appState.status === 'sold' || appState.status === 'unsold') {
    if (btnStepText) btnStepText.textContent = "Bring Player";
    const btnIcon = btnStep.querySelector('.btn-icon');
    if (btnIcon) btnIcon.textContent = "🔨";
    if (autoplayInterval) toggleAutoplay(); // pause autoplay at round transitions
  } else if (appState.status === 'completed') {
    if (btnStepText) btnStepText.textContent = "Completed";
    btnStep.disabled = true;
    btnAutoplay.disabled = true;
  } else {
    if (btnStepText) btnStepText.textContent = "Next Bid Turn";
    const btnIcon = btnStep.querySelector('.btn-icon');
    if (btnIcon) btnIcon.textContent = "⚡";
    btnStep.disabled = false;
    btnAutoplay.disabled = false;
  }

  // Update RTM banner option
  const rtmBanner = document.getElementById('rtm-banner');
  const rtmBannerText = document.getElementById('rtm-banner-text');
  if (rtmBanner && rtmBannerText) {
    if (appState.currentPlayer && appState.currentPlayer.lastTeam && appState.currentPlayer.lastTeam !== 'N/A') {
      rtmBannerText.textContent = `${appState.currentPlayer.lastTeam} HAS RTM OPTION`;
      rtmBanner.classList.remove('hidden');
    } else {
      rtmBanner.classList.add('hidden');
    }
  }

  // Update active categories in header tabs
  updateCategoryTabs();

  // 3. Update User Controlled Team status overview & Sidebar
  const sidebarTeamLogo = document.getElementById('sidebar-team-logo');
  const sidebarTeamName = document.getElementById('sidebar-team-name');
  const sidebarTeamRoleLabel = document.getElementById('sidebar-team-role-label');
  const headerUserPurse = document.getElementById('header-user-purse');
  const headerUserSquad = document.getElementById('header-user-squad');
  const headerUserStatus = document.getElementById('header-user-status');
  
  if (appState.userFranchise) {
    const userTeam = appState.franchises.find(f => f.name === appState.userFranchise);
    if (userTeam) {
      const slug = getTeamSlug(userTeam.name);
      
      // Update top header status
      if (headerUserPurse) headerUserPurse.textContent = `${slug.toUpperCase()}: ₹${(userTeam.remainingBudget / 100).toFixed(2)} Cr`;
      if (headerUserSquad) headerUserSquad.textContent = `Squad: ${userTeam.currentRoster.length}/25`;
      if (headerUserStatus) headerUserStatus.classList.remove('hidden');
      
      // Update sidebar card
      if (sidebarTeamLogo) {
        sidebarTeamLogo.textContent = slug.toUpperCase();
        sidebarTeamLogo.className = `w-12 h-12 rounded-full border border-border-strong flex items-center justify-center font-bold text-sm text-white bg-${slug}`;
        sidebarTeamLogo.style.backgroundColor = swatchColorMap[slug];
      }
      if (sidebarTeamName) {
        sidebarTeamName.textContent = userTeam.name;
        sidebarTeamName.className = `font-headline-sm text-headline-sm text-[16px] font-extrabold truncate w-[160px] text-${slug}`;
        sidebarTeamName.style.color = swatchColorMap[slug];
      }
      if (sidebarTeamRoleLabel) {
        sidebarTeamRoleLabel.textContent = "Your Franchise";
      }
    }
  } else {
    // Spectator mode
    if (headerUserStatus) headerUserStatus.classList.add('hidden');
    
    if (sidebarTeamLogo) {
      sidebarTeamLogo.textContent = "👁️";
      sidebarTeamLogo.className = `w-12 h-12 rounded-full border border-border-strong bg-slate-700 flex items-center justify-center font-bold text-lg text-white`;
      sidebarTeamLogo.style.backgroundColor = '#475569';
    }
    if (sidebarTeamName) {
      sidebarTeamName.textContent = "Spectator Mode";
      sidebarTeamName.className = `font-headline-sm text-headline-sm text-on-surface text-[16px] font-extrabold truncate w-[160px]`;
      sidebarTeamName.style.color = '';
    }
    if (sidebarTeamRoleLabel) {
      sidebarTeamRoleLabel.textContent = "All AI Simulation";
    }
  }

  // 4. Render Active Room Bidders list
  if (activeBiddersList) {
    activeBiddersList.innerHTML = '';
    if (appState.status === 'bidding' && appState.activeBidders) {
      appState.activeBidders.forEach((name, index) => {
        const pill = document.createElement('span');
        pill.className = `bidder-pill`;
        
        const isCurrentTurn = index === appState.currentBidderIndex;
        if (isCurrentTurn) {
          pill.classList.add('active');
        }
        
        pill.textContent = name.replace("Super Kings", "CSK").replace("Knight Riders", "KKR").replace("Indians", "MI").replace("Bengaluru", "RCB").replace("Capitals", "DC").replace("Kings", "PBKS").replace("Royals", "RR").replace("Sunrisers", "SRH").replace("Titans", "GT").replace("Super Giants", "LSG");
        activeBiddersList.appendChild(pill);
      });
    } else {
      activeBiddersList.innerHTML = `<span class="text-xs text-on-surface-variant italic opacity-60">No active bidding session</span>`;
    }
  }

  // 5. Render Bidding Feed Logs
  if (biddingLog) {
    if (appState.biddingHistory && appState.biddingHistory.length > 0) {
      biddingLog.innerHTML = '';
      appState.biddingHistory.forEach(log => {
        const slug = getTeamSlug(log.franchise);
        const logDiv = document.createElement('div');
        logDiv.className = `log-item border-${slug}`;
        
        let badgeClass = 'action-pass';
        let displayAction = log.action;
        if (log.action === 'bid') {
          badgeClass = 'action-bid';
          displayAction = `Bid ${formatPrice(log.amount)}`;
        } else if (log.action === 'pass') {
          badgeClass = 'action-pass';
        }
        
        logDiv.innerHTML = `
          <div class="log-item-header">
            <span class="log-team-name text-${slug}">${log.franchise}</span>
            <span class="log-action-badge ${badgeClass}">${displayAction}</span>
          </div>
          <p class="log-commentary">"${log.commentary}"</p>
        `;
        biddingLog.appendChild(logDiv);
      });
      biddingLog.scrollTop = biddingLog.scrollHeight;
    } else if (appState.status === 'bidding') {
      biddingLog.innerHTML = `
        <div class="log-empty-state">
          <p>Bidding round opened! Awaiting bids on ${appState.currentPlayer.name}...</p>
        </div>`;
    } else if (appState.status === 'sold') {
      const sale = appState.soldPlayers[appState.soldPlayers.length - 1];
      if (sale) {
        biddingLog.innerHTML = `
          <div class="log-item border-${getTeamSlug(sale.franchise)}" style="border-left-width: 6px; padding: 12px;">
            <div class="log-item-header" style="margin-bottom: 4px;">
              <h3 class="text-${getTeamSlug(sale.franchise)} font-bold text-sm">🔨 SOLD!</h3>
              <span class="log-action-badge action-system">Acquisition: ${formatPrice(sale.price)}</span>
            </div>
            <p style="font-size: 0.8rem; font-weight: 700; margin-bottom: 2px;">
              ${sale.player.name} goes to the <span class="text-${getTeamSlug(sale.franchise)}">${sale.franchise}</span>!
            </p>
          </div>`;
      }
    } else if (appState.status === 'unsold') {
      biddingLog.innerHTML = `
        <div class="log-item border-red-500" style="border-left-width: 6px; padding: 12px; background: rgba(239, 68, 68, 0.04);">
          <h3 class="text-error font-bold text-sm" style="margin-bottom: 4px;">🔴 UNSOLD</h3>
          <p style="font-size: 0.8rem;">
            No franchises matched or bid on <strong>${appState.currentPlayer ? appState.currentPlayer.name : 'Player'}</strong>.
          </p>
        </div>`;
    }
  }

  // 6. Fullscreen Sold Overlay (Flash)
  if (appState.status === 'sold' && lastStatus !== 'sold') {
    const sale = appState.soldPlayers[appState.soldPlayers.length - 1];
    if (sale) {
      const overlay = document.getElementById('sold-overlay');
      const soldPlayerName = document.getElementById('sold-player-name');
      const soldWinnerTeam = document.getElementById('sold-winner-team');
      const soldPrice = document.getElementById('sold-price');
      
      if (overlay && soldPlayerName && soldWinnerTeam && soldPrice) {
        soldPlayerName.textContent = sale.player.name;
        soldWinnerTeam.textContent = sale.franchise.replace("Super Kings", "CSK").replace("Knight Riders", "KKR").replace("Indians", "MI").replace("Bengaluru", "RCB").replace("Capitals", "DC").replace("Kings", "PBKS").replace("Royals", "RR").replace("Sunrisers", "SRH").replace("Titans", "GT").replace("Super Giants", "LSG");
        soldPrice.textContent = formatPrice(sale.price);
        
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        
        setTimeout(() => {
          overlay.classList.add('hidden');
          overlay.classList.remove('flex');
        }, 2200);
      }
    }
  }
  lastStatus = appState.status;

  // 7. Render purses overview cards
  if (rosterTabs) {
    rosterTabs.innerHTML = '';
    appState.franchises.forEach(f => {
      const slug = getTeamSlug(f.name);
      const card = document.createElement('div');
      
      const isActive = f.name === selectedFranchiseName;
      card.className = `w-full bg-white/5 rounded-lg border border-white/5 p-3 flex flex-col justify-between cursor-pointer transition-all hover:bg-white/10 ${isActive ? 'active-card' : ''}`;
      
      const color = swatchColorMap[slug] || '#475569';
      card.innerHTML = `
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-2">
            <div class="w-3.5 h-3.5 rounded-full border border-white/20" style="background-color: ${color}"></div>
            <span class="font-label-caps text-xs text-white font-bold tracking-wide">${f.name.replace("Super Kings", "CSK").replace("Knight Riders", "KKR").replace("Indians", "MI").replace("Bengaluru", "RCB").replace("Capitals", "DC").replace("Kings", "PBKS").replace("Royals", "RR").replace("Sunrisers", "SRH").replace("Titans", "GT").replace("Super Giants", "LSG")}</span>
          </div>
          <p class="font-mono-data text-white text-[11px] font-semibold">${f.currentRoster.length}/25</p>
        </div>
        <div class="flex justify-between items-center text-[11px]">
          <span class="text-on-surface-variant font-medium uppercase tracking-wider text-[9px]">Purse Remaining</span>
          <span class="font-mono-data text-secondary font-bold">${formatPrice(f.remainingBudget)}</span>
        </div>
      `;
      
      card.addEventListener('click', () => {
        selectedFranchiseName = f.name;
        showTab('squad');
        updateRosterTabDisplay();
      });
      
      rosterTabs.appendChild(card);
    });
  }

  // 8. Update Detailed Roster Table contents
  updateRosterTabDisplay();

  // 9. Synchronize User Franchise dropdown select
  if (selectUserFranchise && appState) {
    selectUserFranchise.value = appState.userFranchise || '';
  }

  // 10. Handle Awaiting User Turn Action
  if (userBidPanel && btnUserBid && btnStep && appState) {
    if (appState.awaitingUser) {
      if (autoplayInterval) {
        toggleAutoplay(); // pause autoplay so user can make a decision
      }
      userBidPanel.classList.remove('hidden');
      
      // Set user bid button amount text
      let nextBidVal = appState.currentPlayer ? appState.currentPlayer.basePrice : 0;
      if (appState.currentHighBid > 0) {
        let cb = appState.currentHighBid;
        let increment = cb < 50 ? 2 : cb < 200 ? 5 : cb < 500 ? 10 : 20;
        nextBidVal = cb + increment;
      }
      btnUserBid.textContent = `👍 Bid ${formatPrice(nextBidVal)}`;
      btnStep.disabled = true;
    } else {
      userBidPanel.classList.add('hidden');
      btnStep.disabled = false;
    }
  }

  // 11. Update News Marquee Text
  updateNewsMarquee();
}

// Update specific roster view contents
function updateRosterTabDisplay() {
  if (!appState || !selectedFranchiseName) return;

  const f = appState.franchises.find(team => team.name === selectedFranchiseName);
  if (!f) return;

  const slug = getTeamSlug(f.name);
  
  // Update card border highlights in purses overview list
  if (rosterTabs) {
    const cards = rosterTabs.children;
    appState.franchises.forEach((team, index) => {
      if (cards[index]) {
        if (team.name === selectedFranchiseName) {
          cards[index].classList.add('active-card');
        } else {
          cards[index].classList.remove('active-card');
        }
      }
    });
  }

  if (tabTeamName) {
    tabTeamName.textContent = f.name;
    tabTeamName.className = `font-headline-sm text-lg font-bold tracking-tight text-${slug}`;
    tabTeamName.style.color = swatchColorMap[slug];
  }
  if (tabPersonality) {
    tabPersonality.textContent = f.personality.split(':')[1]?.trim() || f.personality;
  }
  
  // Budget values
  const remainingCr = (f.remainingBudget / 100).toFixed(2);
  if (tabBudget) tabBudget.textContent = remainingCr;
  
  // Calculate percentage of budget remaining (starting is 100 Cr = 10000 Lakhs)
  const initialBudget = 10000;
  const pct = Math.round((f.remainingBudget / initialBudget) * 100);
  if (tabBudgetPct) tabBudgetPct.textContent = `${pct}%`;
  
  // Update budget bar percentage width
  if (tabBudgetBar) {
    tabBudgetBar.style.width = `${pct}%`;
    if (pct > 50) {
      tabBudgetBar.style.background = '#00C787'; // timer-safe
    } else if (pct > 20) {
      tabBudgetBar.style.background = '#FF8C00'; // timer-warn
    } else {
      tabBudgetBar.style.background = '#FF3B3B'; // danger
    }
  }
  
  // Populate Table Body
  if (tabRosterBody) {
    tabRosterBody.innerHTML = '';
    if (f.currentRoster && f.currentRoster.length > 0) {
      f.currentRoster.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-white/5 border-b border-white/5 transition-all";
        row.innerHTML = `
          <td class="p-3 font-semibold text-white">${item.name}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-[10px] tracking-wider uppercase">${item.role}</span></td>
          <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] tracking-wider font-semibold uppercase ${item.nationality === 'Indian' ? 'bg-tertiary/10 border border-tertiary/20 text-tertiary' : 'bg-blue-400/10 border border-blue-400/20 text-blue-400'}">${item.nationality}</span></td>
          <td class="p-3 font-bold font-mono-data text-secondary-fixed-dim">${formatPrice(item.price)}</td>
        `;
        tabRosterBody.appendChild(row);
      });
    } else {
      tabRosterBody.innerHTML = `
        <tr>
          <td colspan="4" class="p-6 text-center text-on-surface-variant italic opacity-60">No players acquired yet. Participate in the auction to build the squad roster.</td>
        </tr>`;
    }
  }
}

// Update News Marquee Content
function updateNewsMarquee() {
  if (!newsMarquee || !appState) return;
  
  let text = '';
  if (appState.awaitingUser) {
    text = `🔔 YOUR TURN: Awaiting your bid decision for ${appState.currentPlayer ? appState.currentPlayer.name : 'player'}! Place Bid of ${nextBidTarget.textContent} or Pass Turn to let other agents battle it out.`;
  } else if (appState.status === 'bidding') {
    text = `💥 LIVE BIDDING: Strategic battle on for ${appState.currentPlayer ? appState.currentPlayer.name : 'player'}! • High Bid: ${formatPrice(appState.currentHighBid)} held by ${appState.currentHighBidder || 'opening'} • Next Bid: ${nextBidTarget.textContent} • Active room bidders: ${appState.activeBidders.join(', ')} • Autopilot mode active.`;
  } else if (appState.status === 'sold') {
    const sale = appState.soldPlayers[appState.soldPlayers.length - 1];
    text = `🔨 SOLD! Marquee talent ${sale.player.name} is acquired by the ${sale.franchise} for ${formatPrice(sale.price)}! • CSK and KKR prepare for next lot • GT pacing budgets • Bring next player under the hammer.`;
  } else if (appState.status === 'unsold') {
    text = `⚠️ UNSOLD: ${appState.currentPlayer ? appState.currentPlayer.name : 'Player'} goes unsold as all active franchises pass on bid • Squad allocations remain critical • Bring next player under the hammer.`;
  } else if (appState.status === 'completed') {
    text = `🏆 MEGA AUCTION FINISHED! All squad rosters are completed. Review remaining purses and squad charts in details below.`;
  } else {
    text = `🏏 IPL Mega Auction 2025 Live Agent Simulation Arena initialized. Select Mode and click 'Bring Player' to begin.`;
  }
  newsMarquee.textContent = text;
}

// Start app initialization on load
window.addEventListener('DOMContentLoaded', init);
