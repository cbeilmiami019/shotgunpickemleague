const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
}

// Submit a pick
router.post('/', verifyToken, async (req, res) => {
  const { week_number, team_id } = req.body;  // team_name is replaced with team_id for consistency
  const user_id = req.user.id;

  try {
    // Get the game details for the current week
    const { rows: games } = await pool.query(
      'SELECT * FROM games WHERE week_number = $1',
      [week_number]
    );

    if (games.length === 0) {
      return res.status(400).json({ message: 'No games found for this week.' });
    }

    // Check if any game has started or finished
    const now = new Date();
    const ongoingGame = games.find((game) => new Date(game.game_time) <= now);

    if (ongoingGame) {
      return res.status(400).json({ message: 'Cannot pick for games that have started or finished.' });
    }

    // Check if the user already picked for the week
    const { rows: existing } = await pool.query(
      'SELECT * FROM picks WHERE user_id = $1 AND week_number = $2',
      [user_id, week_number]
    );

    if (existing.length > 0) {
      // Update existing pick
      const update = await pool.query(
        'UPDATE picks SET team_id = $1 WHERE id = $2 RETURNING *',
        [team_id, existing[0].id]
      );
      return res.status(200).json({ message: 'Pick updated!', pick: update.rows[0] });
    }

    // Insert new pick if no ongoing games
    const insert = await pool.query(
      'INSERT INTO picks (user_id, week_number, team_id, result) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, week_number, team_id, 'pending']
    );
    res.status(201).json({ message: 'Pick submitted!', pick: insert.rows[0] });
  } catch (err) {
    console.error('Pick error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET /api/picks/current?week_number=15
router.get('/current', verifyToken, async (req, res) => {
  const user_id = req.user.id;
  const week_number = parseInt(req.query.week_number);

  try {
    const result = await pool.query(
      'SELECT * FROM picks WHERE user_id = $1 AND week_number = $2',
      [user_id, week_number]
    );

    if (result.rows.length > 0) {
      return res.status(200).json({ pick: result.rows[0] });
    } else {
      return res.status(200).json({ pick: null });
    }
  } catch (err) {
    console.error('Error fetching current pick:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Route to get user's pick history
router.get('/history', verifyToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    const { rows } = await pool.query(
      `
 SELECT 
  p.week_number,
  p.team_id,
  t.name AS picked_team_name,
  g.home_team_id,
  g.away_team_id,
  ht.name AS home_team_name,
  at.name AS away_team_name,
  g.score_home,
  g.score_away,
  g.winner_team_id,
  p.result,
  p.created_at
FROM picks p
JOIN teams t ON p.team_id = t.id
JOIN LATERAL (
  SELECT * FROM games 
  WHERE week_number = p.week_number 
    AND (home_team_id = p.team_id OR away_team_id = p.team_id)
  LIMIT 1
) g ON true
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at ON g.away_team_id = at.id
WHERE p.user_id = $1
ORDER BY p.week_number DESC;


      `,
      [user_id]
    );


    res.json({ history: rows });
  } catch (err) {
    console.error('[GET /history] DB Error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve history' });
  }
});




module.exports = router;
