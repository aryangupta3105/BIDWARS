/**
 * Local Heuristic Agent for offline/demo simulations.
 * Mimics the personalities of the 10 IPL franchises.
 */
function getIncrement(currentBid) {
  if (currentBid < 50) return 2;
  if (currentBid < 200) return 5;
  if (currentBid < 500) return 10;
  return 20;
}

export function getBidHeuristic(franchiseConfig, auctionState, playerData) {
  const { name, remainingBudget, targetGaps, maxBid } = franchiseConfig;
  const { currentHighBid, currentHighBidder } = auctionState;
  const { name: pName, role, nationality, basePrice, lastTeam, stats } = playerData;

  // Budget constraint check
  if (remainingBudget < basePrice) {
    return {
      action: "pass",
      commentary: `[LOCAL SIM] Budget is too low (${remainingBudget} Lakhs) for base price (${basePrice} Lakhs).`
    };
  }

  const nextBid = !currentHighBid || currentHighBid === 0 ? basePrice : currentHighBid + getIncrement(currentHighBid);

  if (remainingBudget < nextBid) {
    return {
      action: "pass",
      commentary: `[LOCAL SIM] Cannot afford next bid of ${nextBid} Lakhs.`
    };
  }

  // Personalities heuristic logic
  let interestScore = 50; // Base interest out of 100

  // 1. Check if role fits target gaps
  if (targetGaps.includes(role)) {
    interestScore += 20;
  }

  // 2. Personality-specific adjustment
  let commentary = "";
  let bidLimit = maxBid || (remainingBudget * 0.5); // Default bid limit is 50% of budget

  switch (name) {
    case "Mumbai Indians":
      // pays premium for proven match-winners, avoids young unknowns
      const isProven = stats.matches > 100 || stats.wickets > 100 || stats.runs > 3000;
      const isYoungUnknown = stats.matches < 30;
      if (isProven) {
        interestScore += 30;
        bidLimit = Math.min(remainingBudget, 2200);
        commentary = `We need a marquee match-winner like ${pName}. The numbers back him up, and we are willing to spend big.`;
      } else if (isYoungUnknown) {
        interestScore -= 40;
        commentary = `He's too unproven for our data-driven model. We will pass and look for established winners.`;
      } else {
        interestScore += 5;
        commentary = `Decent stats. Let's see if we can acquire ${pName} at a reasonable valuation.`;
      }
      break;

    case "Chennai Super Kings":
      // values experience and loyalty, overpays for ex-CSK players, slow bidder
      const isExperienced = stats.matches > 120;
      const isExCSK = lastTeam === "CSK";
      if (isExCSK) {
        interestScore += 45;
        bidLimit = Math.min(remainingBudget, 2000);
        commentary = `Once a Super King, always a Super King! Bringing ${pName} back home is our top priority, budget is no bar.`;
      } else if (isExperienced) {
        interestScore += 25;
        bidLimit = Math.min(remainingBudget, 1600);
        commentary = `Experience wins tournaments. ${pName} has played ${stats.matches} matches and brings the stability we value.`;
      } else {
        interestScore -= 20;
        commentary = `We prefer seasoned heads in our dressing room. We will skip this one.`;
      }
      break;

    case "Royal Challengers Bengaluru":
      // star-obsessed, overbids on big names, neglects bowling depth
      const isStar = ["Virat Kohli", "MS Dhoni", "Glenn Maxwell", "Rashid Khan", "Pat Cummins", "Mitchell Starc", "Nicholas Pooran", "Travis Head"].includes(pName);
      const isBowler = role === "Bowler";
      if (isStar) {
        interestScore += 50;
        bidLimit = Math.min(remainingBudget, 3000); // Massive budget for stars
        commentary = `${pName} is a box-office player! The fans want him, and we will do whatever it takes to secure this superstar.`;
      } else if (isBowler) {
        interestScore -= 10; // Neglects bowling depth
        bidLimit = Math.min(remainingBudget, 800);
        commentary = `We'll put in a small bid, but we'd rather conserve our funds for explosive batsmen.`;
      } else {
        interestScore += 10;
        commentary = `Adds depth to our batting group. Let's make a play for him.`;
      }
      break;

    case "Kolkata Knight Riders":
      // shrewd analytics team, hunts undervalued players, won't chase
      const isUndervalued = basePrice <= 150 && (stats.sr > 140 || stats.economy < 7.5);
      bidLimit = Math.min(remainingBudget, 1200); // Strict valuation limit
      if (isUndervalued) {
        interestScore += 30;
        commentary = `Our metrics show ${pName} is highly undervalued at this base price. A perfect tactical fit.`;
      } else if (nextBid > bidLimit) {
        interestScore = 0; // Won't chase
        commentary = `The bidding has crossed our analytical valuation limit of ${bidLimit} Lakhs. We are out.`;
      } else {
        interestScore += 5;
        commentary = `A solid utility option. We'll bid up to our strict data threshold.`;
      }
      break;

    case "Delhi Capitals":
      // aggressive early, runs out of budget late, youth-focused
      const isYouth = stats.matches < 50;
      const isLateStage = remainingBudget < 3000;
      if (isLateStage) {
        interestScore -= 30;
        commentary = `We spent aggressively early on and our budget is running dry. We must pass.`;
      } else if (isYouth) {
        interestScore += 35;
        bidLimit = Math.min(remainingBudget, 1500);
        commentary = `Young, hungry, and full of potential. ${pName} fits our blueprint for the future.`;
      } else {
        interestScore += 15;
        commentary = `A quality asset. We will bid aggressively to secure him.`;
      }
      break;

    case "Punjab Kings":
      // inconsistent, sometimes goes berserk on one player then disappears
      const goesBerserk = Math.random() > 0.6;
      if (goesBerserk) {
        interestScore += 50;
        bidLimit = Math.min(remainingBudget, 2800);
        commentary = `We want ${pName} in our squad and we are going all-in! No holds barred on this bid!`;
      } else {
        interestScore = 10;
        commentary = `We are choosing to sit back on this one and watch how the room reacts.`;
      }
      break;

    case "Rajasthan Royals":
      // value hunters, loves T20 specialists from non-India leagues
      const isOverseasSpecialist = nationality === "Overseas" && (role === "All-Rounder" || role === "Bowler");
      if (isOverseasSpecialist) {
        interestScore += 35;
        bidLimit = Math.min(remainingBudget, 1300);
        commentary = `Excellent overseas T20 matchup numbers. ${pName} is a top value pick for our analytics.`;
      } else {
        interestScore += 5;
        bidLimit = Math.min(remainingBudget, 900);
        commentary = `We will bid only if the price remains within a strict moneyball value range.`;
      }
      break;

    case "Sunrisers Hyderabad":
      // aggressive, top-order fixated, pays huge for openers
      const isOpener = role === "Batsman" && (pName === "Travis Head" || pName === "Yashasvi Jaiswal" || stats.sr > 145);
      if (isOpener) {
        interestScore += 45;
        bidLimit = Math.min(remainingBudget, 2500);
        commentary = `We need fire at the top! ${pName} is an explosive opener and we will bid fiercely to get him.`;
      } else {
        interestScore += 10;
        bidLimit = Math.min(remainingBudget, 1000);
        commentary = `A solid player, but we are holding back our heavy artillery for top-order options.`;
      }
      break;

    case "Gujarat Titans":
      // calm and calculated, builds around a strong core, never panics
      const fitsCore = role === "All-Rounder" || role === "Bowler";
      bidLimit = Math.min(remainingBudget, 1400);
      if (fitsCore) {
        interestScore += 25;
        commentary = `${pName} is a solid team-first player who stabilizes our middle-overs. Let's make a calculated bid.`;
      } else {
        interestScore += 10;
        commentary = `We will bid calmly within our boundaries. No panic, just structural planning.`;
      }
      break;

    case "Lucknow Super Giants":
      // reactive, fills gaps last-minute, mid-tier bids on everything
      interestScore += 20;
      bidLimit = Math.min(remainingBudget, 1100);
      commentary = `Let's throw in a bid for ${pName} to test the water. We need options for our middle order.`;
      break;

    default:
      interestScore = 30;
      commentary = `Let's make a standard evaluation of ${pName}.`;
  }

  // Final decision: if interest is high and nextBid is within limit
  const willBid = interestScore >= 40 && nextBid <= bidLimit;

  if (willBid) {
    return {
      action: "bid",
      amount: nextBid,
      commentary: commentary
    };
  } else {
    return {
      action: "pass",
      commentary: commentary || `We'll pass on ${pName} at this stage.`
    };
  }
}
