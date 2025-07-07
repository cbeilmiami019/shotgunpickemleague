const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/games?week=1
router.get('/', async (req, res) => {
  const week = parseInt(req.query.week);

  if (isNaN(week)) {
    return res.status(400).json({ message: 'Invalid or missing week number' });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        games.id,
        games.week_number,
        games.score_home,
        games.score_away,
        games.status,
        games.winner_team_id,
        home_team.name AS home_team,
        away_team.name AS away_team
      FROM games
      JOIN teams AS home_team ON games.home_team_id = home_team.id
      JOIN teams AS away_team ON games.away_team_id = away_team.id
      WHERE games.week_number = $1
      ORDER BY home_team.name
      `,
      [week]
    );

    res.json({ games: result.rows });
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ message: 'Server error fetching games' });
  }
});

module.exports = router;
