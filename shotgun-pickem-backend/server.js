const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

const dotenv = require('dotenv');
// Load .env config
dotenv.config(); // ✅ THIS must come before you use process.env.DATABASE_URL

const { Pool } = require('pg');

// Create server app
const PORT = process.env.PORT || 5000;

const authenticateToken = require('./routes/authMiddleware');

//pick Route
const picksRoutes = require('./routes/picks');
app.use('/api/picks', picksRoutes);

//leaderboard Route
const leaderboardRoutes = require('./routes/leaderboard');
app.use('/api/leaderboard', leaderboardRoutes);

//Active pick should show up when refreshing, if one exists
app.use('/api/picks', require('./routes/picks'));

//games Route
app.use('/api/games', require('./routes/games'));


// Connect to PostgreSQL using Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

// Test DB endpoint
app.get('/api/test-db', async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW()');
      res.json({ message: 'Database connection successful', timestamp: result.rows[0].now });
    } catch (err) {
      console.error('Database test error:', err);
      res.status(500).json({ message: 'Database connection failed' });
    }
  });

// ✅ GET all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ✅ GET all picks
app.get('/api/picks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM picks');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});


app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({
    message: `Welcome, ${req.user.username}! You have accessed a protected route.`,
    user: req.user
  });
});


// Start the server
app.listen(PORT, () => {
  console.log(`🏈 Shotgun Pick'em Backend running on port ${PORT}`);
});


const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
