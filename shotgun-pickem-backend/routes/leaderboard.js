const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET leaderboard
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        COUNT(p.*) AS total_picks,
        COUNT(CASE WHEN p.result = 'win' THEN 1 END) AS correct_picks
      FROM users u
      LEFT JOIN picks p ON u.id = p.user_id
      GROUP BY u.id
      ORDER BY correct_picks DESC, total_picks DESC
    `);

    res.json({ leaderboard: result.rows });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Server error loading leaderboard' });
  }
});

module.exports = router;
