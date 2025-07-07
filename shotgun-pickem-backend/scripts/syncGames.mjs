import fetch from 'node-fetch';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const CURRENT_WEEK = 1;

async function fetchGamesFromESPN() {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${CURRENT_WEEK}&year=2024&seasontype=2`;
  const res = await fetch(url);
  const data = await res.json();
  return data.events;
}

async function upsertGames(events) {
  for (const event of events) {
    const gameId = event.id;
    const competition = event.competitions[0];
    const rawStatus = competition.status.type.name;
    const date = competition.date;

    const home = competition.competitors.find(c => c.homeAway === 'home');
    const away = competition.competitors.find(c => c.homeAway === 'away');

    const homeTeamId = await getTeamIdByAbbreviation(home.team.abbreviation);
    const awayTeamId = await getTeamIdByAbbreviation(away.team.abbreviation);

    const homeScore = parseInt(home.score);
    const awayScore = parseInt(away.score);

    // Normalize ESPN status to match your DB values
    let status;
    if (rawStatus === 'STATUS_SCHEDULED' || rawStatus === 'STATUS_PREVIEW') {
      status = 'scheduled';
    } else if (rawStatus === 'STATUS_IN_PROGRESS' || rawStatus === 'STATUS_HALFTIME') {
      status = 'in_progress';
    } else if (rawStatus === 'STATUS_FINAL') {
      status = 'completed';
    } else {
      status = 'scheduled'; // fallback
    }

    const completed = status === 'completed';
    const winnerId = completed ? (home.winner ? homeTeamId : awayTeamId) : null;

    await pool.query(
      `INSERT INTO games (game_id, week_number, game_time, home_team_id, away_team_id, score_home, score_away, completed, winner_team_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (game_id) DO UPDATE
       SET score_home = $6,
           score_away = $7,
           completed = $8,
           winner_team_id = $9,
           status = $10;`,
      [
        gameId,
        CURRENT_WEEK,
        date,
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        completed,
        winnerId,
        status,
      ]
    );
  }
}

async function getTeamIdByAbbreviation(abbr) {
  const result = await pool.query(
    'SELECT id FROM teams WHERE abbreviation = $1',
    [abbr]
  );
  return result.rows[0]?.id || null;
}

async function main() {
  try {
    const events = await fetchGamesFromESPN();
    await upsertGames(events);
    console.log('✅ Games synced successfully');
  } catch (err) {
    console.error('❌ Error syncing games:', err.message);
  } finally {
    await pool.end();
  }
}

main();
