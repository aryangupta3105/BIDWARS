import { getBid } from './agents/franchiseAgent.js';

async function runTests() {
  console.log("=== STARTING IPL AUCTION AGENT TESTS ===");

  // Mock player: MS Dhoni (ex-CSK player, highly experienced)
  const playerDhoni = {
    name: "MS Dhoni",
    role: "Wicketkeeper-Batsman",
    nationality: "Indian",
    basePrice: 200,
    base_price_cr: 2.0,
    stats: {
      matches: 250,
      runs: 5000,
      avg: 39.0,
      sr: 137.5,
      wickets: 0,
      economy: 0
    },
    lastTeam: "CSK"
  };

  // Mock player: Young unknown player
  const playerUnknown = {
    name: "Anuj Rawat",
    role: "Wicketkeeper-Batsman",
    nationality: "Indian",
    basePrice: 50,
    stats: {
      matches: 25,
      runs: 300,
      avg: 20.0,
      sr: 120.0,
      wickets: 0,
      economy: 0
    },
    lastTeam: "RCB"
  };

  // Franchise config: CSK (values experience and loyalty)
  const cskConfig = {
    name: "Chennai Super Kings",
    personality: "CSK: values experience and loyalty, overpays for ex-CSK players, slow bidder",
    remainingBudget: 10000,
    currentRoster: [],
    targetGaps: ["Wicketkeeper-Batsman"],
    maxBid: 1500
  };

  // Franchise config: MI (data-driven, avoids young unknowns)
  const miConfig = {
    name: "Mumbai Indians",
    personality: "Mumbai Indians: data-driven, pays premium for proven match-winners, avoids young unknowns",
    remainingBudget: 10000,
    currentRoster: [],
    targetGaps: ["Wicketkeeper-Batsman"],
    maxBid: 1800
  };

  // Auction State: Opening bid
  const initialState = {
    currentPlayer: "MS Dhoni",
    currentHighBid: 0,
    currentHighBidder: null,
    roundNumber: 1
  };

  // Test 1: Budget Constraint Check (remainingBudget < basePrice)
  console.log("\n--- Test 1: Budget Constraint Check (should pass immediately) ---");
  const lowBudgetConfig = { ...cskConfig, remainingBudget: 1.5 };
  const budgetTestResult = await getBid(lowBudgetConfig, initialState, playerDhoni);
  console.log("Result:", budgetTestResult);
  if (budgetTestResult.action === "pass" && budgetTestResult.commentary.includes("purse")) {
    console.log("✅ Test 1 Passed!");
  } else {
    console.error("❌ Test 1 Failed!");
  }

  // Test 2: Standard Agent Call (No API Key)
  console.log("\n--- Test 2: Agent Call (Checking Error Catching & Default Action) ---");
  // Temporarily unset API Key to verify safe default behavior
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const start = Date.now();
  const errorTestResult = await getBid(cskConfig, initialState, playerDhoni);
  const duration = Date.now() - start;

  console.log("Result:", errorTestResult);
  console.log(`Execution Duration: ${duration}ms`);

  if (errorTestResult.action === "pass" && duration >= 500 && duration <= 1800) {
    console.log("✅ Test 2 Passed (Returned pass, handled error, simulated thinking delay)!");
  } else {
    console.error("❌ Test 2 Failed!");
  }

  // Restore API key
  if (originalApiKey) {
    process.env.OPENAI_API_KEY = originalApiKey;
  }

  console.log("\n=== TESTS COMPLETE ===");
}

runTests().catch(console.error);
