import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Dynamically assembles the system prompt for OpenAI to govern the AI bidding strategy.
 * @param {Object} franchiseConfig
 * @returns {string} The fully constructed system prompt
 */
export function buildSystemPrompt(franchiseConfig) {
  const { name, remainingBudget, currentRoster, targetGaps, personality } = franchiseConfig;
  
  // Calculate squad composition
  const squadSize = currentRoster.length;
  const rolesCount = { 'BATTER': 0, 'BOWLER': 0, 'ALLROUNDER': 0, 'WK': 0 };
  
  currentRoster.forEach(p => {
    let r = p.role ? p.role.toUpperCase() : '';
    if (r.includes('BAT')) rolesCount['BATTER']++;
    else if (r.includes('BOWL')) rolesCount['BOWLER']++;
    else if (r.includes('ALL')) rolesCount['ALLROUNDER']++;
    else if (r.includes('WK') || r.includes('WICKET')) rolesCount['WK']++;
  });
  
  const squadComposition = `Total: ${squadSize}/25, Batters: ${rolesCount['BATTER']}, Bowlers: ${rolesCount['BOWLER']}, All-Rounders: ${rolesCount['ALLROUNDER']}, WK: ${rolesCount['WK']}`;

  return `1. ROLE: "You are the auction strategist for ${name}, an IPL franchise. You are bidding in a live IPL player auction against 9 other teams."

2. TEAM PROFILE:
   - Current purse remaining: ₹${remainingBudget}Cr
   - Squad composition: ${squadComposition}
   - Gaps to fill: ${targetGaps.join(', ')}
   - Personality rules: ${personality}

3. DECISION RULES:
   - Never bid more than 40% of remaining purse on one player
   - Never bid if you already lead the bidding
   - If a player fills a critical gap, bid up to 25% above fair value
   - If you have plenty of budget and under 15 players, be more aggressive
   - Generate a short, in-character commentary line (max 12 words, cheeky franchise voice)

4. OUTPUT FORMAT (strict):
   Respond ONLY with a valid JSON object, no markdown, no explanation:
   { "action": "bid" | "pass", "amount": number | null, "commentary": string }
   amount must be current_high_bid + 0.25 minimum, rounded to nearest 0.25
   commentary must be < 15 words, team-voiced, energetic

5. EXAMPLES:
   Input: Player = Jasprit Bumrah, current bid = ₹15Cr, team needs pace bowling
   Output: { "action": "bid", "amount": 15.25, "commentary": "Bumrah in blue! No price too high for the best!" }

   Input: Player = a young unknown batter, current bid = ₹8Cr, team already has 4 batters
   Output: { "action": "pass", "amount": null, "commentary": "Not our fight. Saving for the real prizes." }`;
}

/**
 * AI Franchise Agent for bidding decisions
 * @param {Object} franchiseConfig 
 * @param {Object} auctionState 
 * @param {Object} playerData 
 * @returns {Promise<{ action: "bid"|"pass", amount: number|null, commentary: string }>}
 */
export async function getBid(franchiseConfig, auctionState, playerData) {
  const { name, remainingBudget, currentRoster } = franchiseConfig;
  const { currentHighBid, currentHighBidder } = auctionState;
  const { name: pName, role, base_price_cr } = playerData;

  // Next minimum bid
  const nextBid = currentHighBid > 0 ? currentHighBid + 0.25 : base_price_cr;

  // 1. Basic Constraints validation
  if (remainingBudget < nextBid) {
    return {
      action: "pass",
      amount: null,
      commentary: "Our purse is exhausted for this bid level."
    };
  }

  if (currentHighBidder === name) {
    return {
      action: "pass",
      amount: null,
      commentary: "We currently hold the high bid. Waiting."
    };
  }
  
  if (currentRoster.length >= 25) {
    return {
      action: "pass",
      amount: null,
      commentary: "Our roster is full."
    };
  }

  // 2. Build system prompt
  const systemPrompt = buildSystemPrompt(franchiseConfig);

  // 3. Build user message
  const userMessage = `Input: Player = ${pName} (${role}), current bid = ₹${currentHighBid || 0}Cr, base price = ₹${base_price_cr}Cr, current high bidder = ${currentHighBidder || 'None'}`;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing from environment.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${errorText}`);
    }

    const result = await response.json();
    const responseText = result.choices[0].message.content.trim();

    // 4. Parse JSON
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(responseText);
      }
    } catch (err) {
      throw new Error(`Failed to parse response JSON: ${responseText}`);
    }

    // 5. Enforce Constraints on AI's output
    if (parsedResponse.action === 'bid') {
      // Ensure amount is properly rounded to 0.25 increment
      let amt = parseFloat(parsedResponse.amount);
      if (isNaN(amt)) amt = nextBid;
      amt = Math.max(nextBid, Math.round(amt * 4) / 4);
      
      if (amt > remainingBudget) {
        parsedResponse.action = 'pass';
        parsedResponse.amount = null;
        parsedResponse.commentary = "Cannot exceed remaining purse.";
      } else {
        parsedResponse.amount = amt;
      }
    } else {
      parsedResponse.amount = null;
    }

    // 6. Thinking delay
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    return parsedResponse;

  } catch (error) {
    console.error(`[franchiseAgent] Error for ${name}:`, error.message);
    throw error;
  }
}
