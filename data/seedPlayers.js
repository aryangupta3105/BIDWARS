import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Use environment variables for DB connection, fallback to local standard defaults
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'ipl_auction',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
});

const franchises = [
  { name: 'Mumbai Indians', short: 'MI', p_color: '#004B87', s_color: '#D1AB3E', city: 'Mumbai', personality: 'Data-driven, pays premium for proven match-winners, avoids young unknowns' },
  { name: 'Chennai Super Kings', short: 'CSK', p_color: '#F8E000', s_color: '#194383', city: 'Chennai', personality: 'Values experience and loyalty, overpays for ex-CSK players, slow bidder' },
  { name: 'Royal Challengers Bengaluru', short: 'RCB', p_color: '#D11D27', s_color: '#000000', city: 'Bengaluru', personality: 'Star-obsessed, overbids on big names, neglects bowling depth' },
  { name: 'Kolkata Knight Riders', short: 'KKR', p_color: '#3A225D', s_color: '#B89C33', city: 'Kolkata', personality: 'Shrewd analytics team, hunts undervalued players, won\'t chase' },
  { name: 'Delhi Capitals', short: 'DC', p_color: '#005CA5', s_color: '#D71A21', city: 'New Delhi', personality: 'Aggressive early, runs out of budget late, youth-focused' },
  { name: 'Punjab Kings', short: 'PBKS', p_color: '#D71A21', s_color: '#D1D5DB', city: 'Mohali', personality: 'Inconsistent, sometimes goes berserk on one player then disappears' },
  { name: 'Rajasthan Royals', short: 'RR', p_color: '#E03175', s_color: '#004B87', city: 'Jaipur', personality: 'Value hunters, loves T20 specialists from non-India leagues' },
  { name: 'Sunrisers Hyderabad', short: 'SRH', p_color: '#F26522', s_color: '#000000', city: 'Hyderabad', personality: 'Aggressive, top-order fixated, pays huge for openers' },
  { name: 'Gujarat Titans', short: 'GT', p_color: '#0B2240', s_color: '#E3C16C', city: 'Ahmedabad', personality: 'Calm and calculated, builds around a strong core, never panics' },
  { name: 'Lucknow Super Giants', short: 'LSG', p_color: '#00A896', s_color: '#D4AF37', city: 'Lucknow', personality: 'Reactive, fills gaps last-minute, mid-tier bids on everything' }
];

const mainPlayers = [
  { name: 'Virat Kohli', nat: 'IND', role: 'BATTER', base: 2.0, mat: 240, run: 7500, avg: 38.5, sr: 135.2, c: 7, f: 55, wkt: 4, eco: 8.8, bavg: 45.2, bf: '2/25', last: 'RCB', form: 9, inj: false, tier: 'ICON' },
  { name: 'Rohit Sharma', nat: 'IND', role: 'BATTER', base: 2.0, mat: 245, run: 6200, avg: 29.8, sr: 130.5, c: 1, f: 42, wkt: 15, eco: 8.1, bavg: 30.5, bf: '4/6', last: 'MI', form: 8, inj: false, tier: 'ICON' },
  { name: 'MS Dhoni', nat: 'IND', role: 'WK', base: 2.0, mat: 250, run: 5082, avg: 38.8, sr: 136.0, c: 0, f: 24, wkt: 0, eco: 0, bavg: 0, bf: '-', last: 'CSK', form: 8, inj: false, tier: 'ICON' },
  { name: 'Jasprit Bumrah', nat: 'IND', role: 'BOWLER', base: 2.0, mat: 120, run: 60, avg: 8.5, sr: 95.0, c: 0, f: 0, wkt: 145, eco: 7.3, bavg: 23.3, bf: '5/10', last: 'MI', form: 10, inj: false, tier: 'ICON' },
  { name: 'Hardik Pandya', nat: 'IND', role: 'ALLROUNDER', base: 2.0, mat: 125, run: 2309, avg: 30.1, sr: 145.8, c: 0, f: 10, wkt: 53, eco: 8.8, bavg: 33.2, bf: '3/17', last: 'MI', form: 8, inj: false, tier: 'ICON' },
  { name: 'KL Rahul', nat: 'IND', role: 'WK', base: 1.0, mat: 118, run: 4163, avg: 46.8, sr: 134.4, c: 4, f: 33, wkt: 0, eco: 0, bavg: 0, bf: '-', last: 'LSG', form: 8, inj: false, tier: 'PREMIUM' },
  { name: 'Suryakumar Yadav', nat: 'IND', role: 'BATTER', base: 2.0, mat: 139, run: 3249, avg: 32.1, sr: 143.3, c: 1, f: 21, wkt: 0, eco: 0, bavg: 0, bf: '-', last: 'MI', form: 9, inj: false, tier: 'ICON' },
  { name: 'Rashid Khan', nat: 'AFG', role: 'ALLROUNDER', base: 2.0, mat: 109, run: 443, avg: 12.1, sr: 165.2, c: 0, f: 0, wkt: 139, eco: 6.6, bavg: 20.7, bf: '4/24', last: 'GT', form: 9, inj: false, tier: 'ICON' },
  { name: 'Pat Cummins', nat: 'AUS', role: 'BOWLER', base: 2.0, mat: 42, run: 359, avg: 18.8, sr: 152.1, c: 0, f: 1, wkt: 45, eco: 8.5, bavg: 30.1, bf: '4/34', last: 'SRH', form: 9, inj: false, tier: 'ICON' },
  { name: 'Jos Buttler', nat: 'ENG', role: 'WK', base: 2.0, mat: 96, run: 3223, avg: 38.0, sr: 148.3, c: 5, f: 19, wkt: 0, eco: 0, bavg: 0, bf: '-', last: 'RR', form: 9, inj: false, tier: 'ICON' },
  { name: 'Ravindra Jadeja', nat: 'IND', role: 'ALLROUNDER', base: 2.0, mat: 226, run: 2677, avg: 26.5, sr: 128.8, c: 0, f: 2, wkt: 152, eco: 7.6, bavg: 29.5, bf: '5/16', last: 'CSK', form: 8, inj: false, tier: 'ICON' },
  { name: 'Mohammed Shami', nat: 'IND', role: 'BOWLER', base: 1.0, mat: 110, run: 75, avg: 5.0, sr: 96.0, c: 0, f: 0, wkt: 127, eco: 8.4, bavg: 26.8, bf: '4/11', last: 'GT', form: 7, inj: true, tier: 'PREMIUM' },
  { name: 'Shubman Gill', nat: 'IND', role: 'BATTER', base: 2.0, mat: 91, run: 2790, avg: 37.7, sr: 134.0, c: 3, f: 18, wkt: 0, eco: 0, bavg: 0, bf: '-', last: 'GT', form: 9, inj: false, tier: 'ICON' },
  { name: 'Rishabh Pant', nat: 'IND', role: 'WK', base: 1.0, mat: 98, run: 2838, avg: 34.6, sr: 147.9, c: 1, f: 15, wkt: 0, eco: 0, bavg: 0, bf: '-', last: 'DC', form: 8, inj: false, tier: 'PREMIUM' },
  { name: 'Trent Boult', nat: 'NZ', role: 'BOWLER', base: 1.0, mat: 88, run: 35, avg: 4.1, sr: 80.0, c: 0, f: 0, wkt: 105, eco: 8.2, bavg: 26.5, bf: '4/18', last: 'RR', form: 8, inj: false, tier: 'PREMIUM' }
];

// Generate 35 dynamic realistic players
const roles = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK'];
const nats = ['IND', 'AUS', 'ENG', 'SA', 'WI', 'NZ', 'SL', 'PAK'];
const tiers = [{t: 'PREMIUM', p: 1.0}, {t: 'STANDARD', p: 0.5}, {t: 'EMERGING', p: 0.2}];
const namesDB = ['Rajat Patidar', 'Tilak Varma', 'Rinku Singh', 'Yashasvi Jaiswal', 'Arshdeep Singh', 'Avesh Khan', 'Washington Sundar', 'Ravi Bishnoi', 'Cameron Green', 'Sam Curran', 'Phil Salt', 'Heinrich Klaasen', 'Mitchell Starc', 'Gerald Coetzee', 'Marcus Stoinis', 'Kagiso Rabada', 'Liam Livingstone', 'Nicholas Pooran', 'Quinton de Kock', 'Wanindu Hasaranga', 'Mohammad Amir', 'Jason Holder', 'David Miller', 'Deepak Chahar', 'Mukesh Kumar', 'Prithvi Shaw', 'Shivam Dube', 'Ruturaj Gaikwad', 'Ishan Kishan', 'Ajinkya Rahane', 'Venkatesh Iyer', 'Harshal Patel', 'Shardul Thakur', 'Natarajan', 'Mayank Agarwal'];
const allPlayers = [...mainPlayers];

namesDB.forEach((n, idx) => {
  const isInd = idx > 20 || idx < 8; // Arbitrary mix
  const nat = isInd ? 'IND' : nats[Math.floor(Math.random() * (nats.length - 1)) + 1];
  const role = roles[Math.floor(Math.random() * roles.length)];
  const tierObj = tiers[Math.floor(Math.random() * tiers.length)];
  
  const mat = Math.floor(Math.random() * 80) + 10;
  
  let p = {
    name: n, nat, role, base: tierObj.p, mat,
    run: 0, avg: 0, sr: 0, c: 0, f: 0,
    wkt: 0, eco: 0, bavg: 0, bf: '-',
    last: franchises[Math.floor(Math.random() * franchises.length)].short,
    form: Math.floor(Math.random() * 5) + 4,
    inj: false, tier: tierObj.t
  };
  
  if (role === 'BATTER' || role === 'WK') {
    p.run = mat * (Math.floor(Math.random() * 20) + 15);
    p.avg = (Math.random() * 20 + 20).toFixed(1);
    p.sr = (Math.random() * 40 + 120).toFixed(1);
    p.f = Math.floor(mat / 4);
  } else if (role === 'BOWLER') {
    p.wkt = mat * Math.floor(Math.random() * 2) + 1;
    p.eco = (Math.random() * 3 + 7).toFixed(1);
    p.bavg = (Math.random() * 15 + 20).toFixed(1);
    p.bf = `${Math.floor(Math.random()*3)+3}/${Math.floor(Math.random()*20)+10}`;
  } else {
    p.run = mat * 10; p.avg = 20.0; p.sr = 130.0; p.f = Math.floor(mat / 10);
    p.wkt = Math.floor(mat * 0.8); p.eco = 8.5; p.bavg = 28.0; p.bf = '2/20';
  }
  allPlayers.push(p);
});

async function runSeed() {
  console.log("Connecting to Database...");
  let client;
  try {
    client = await pool.connect();
    
    console.log("Seeding Franchises...");
    for (const f of franchises) {
      await client.query(`
        INSERT INTO franchises (name, short_code, primary_color, secondary_color, salary_cap_cr, home_city, personality_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (name) DO NOTHING
      `, [f.name, f.short, f.p_color, f.s_color, 120.00, f.city, f.personality]);
    }

    console.log(`Seeding ${allPlayers.length} Players...`);
    for (const p of allPlayers) {
      await client.query(`
        INSERT INTO players 
        (name, nationality, role, base_price_cr, ipl_matches, ipl_runs, ipl_avg, ipl_sr, ipl_100s, ipl_50s, ipl_wickets, ipl_economy, ipl_bowling_avg, ipl_best_figures, last_ipl_team, form_rating, injury_flag, tier)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (name) DO NOTHING
      `, [p.name, p.nat, p.role, p.base, p.mat, p.run, p.avg, p.sr, p.c, p.f, p.wkt, p.eco, p.bavg, p.bf, p.last, p.form, p.inj, p.tier]);
    }

    console.log("Database Seeded Successfully!");
  } catch (err) {
    console.error("Error seeding database:", err);
  } finally {
    if (client) client.release();
    pool.end();
  }
}

runSeed();
