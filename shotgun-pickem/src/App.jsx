import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [leaderboard, setLeaderboard] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [games, setGames] = useState([]);
  const [currentPick, setCurrentPick] = useState(null);
  const [history, setHistory] = useState([]);
  const [teams, setTeams] = useState([]); // Store teams data

  const currentWeek = 1; // Change manually for now, eventually fetched dynamically

  // Function to get the full name of the team
  const getTeamName = (teamId) => {
    if (!teams || teams.length === 0) {
      return 'Unknown Team'; // Default if no team found
    }
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : 'Unknown Team'; // Use full team name
  };

  // Function to handle login
  const handleLogin = async () => {
    const email = document.querySelector('input[placeholder="Email"]').value;
    const password = document.querySelector('input[placeholder="Password"]').value;

    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('token', data.token);
      setUser({ email });
      setCurrentPage('picks');
    } else {
      alert(data.message || 'Login failed');
    }
  };

  // Fetching data when the page changes
  useEffect(() => {
    const fetchPickAndGames = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const jwtModule = await import('jwt-decode');
        const decoded = jwtDecode(token);
        const userId = decoded.id;

        const pickRes = await fetch(`http://localhost:5000/api/picks/current?week_number=${currentWeek}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const pickData = await pickRes.json();
        setCurrentPick(pickData.pick);

        const gamesRes = await fetch(`http://localhost:5000/api/games?week=${currentWeek}`);
        const gamesData = await gamesRes.json();
        setTeams(gamesData.teams); // Set teams data in state
        const updatedGames = gamesData.games.map((game) => ({
          ...game,
          disabled: new Date(game.game_time) <= new Date(),
        }));

        setGames(updatedGames);
      } catch (err) {
        console.error('Failed to fetch current pick or games', err);
      }
    };

    if (currentPage === 'picks') {
      fetchPickAndGames();
    }
  }, [currentPage, currentWeek]);

  // Handle pick submission
  const handlePick = async (teamId, currentWeek) => {
    const token = localStorage.getItem('token');

    try {
      const response = await fetch('http://localhost:5000/api/picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          week_number: currentWeek,
          team_id: teamId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPick(data.pick);
        setSuccessMessage('Pick submitted!');
        setTimeout(() => setSuccessMessage(''), 3000);
        console.log('Pick submitted:', data);
      } else {
        const errData = await response.json();
        alert(errData.message || 'Error submitting pick');
      }
    } catch (err) {
      console.error('Error submitting pick:', err);
      alert('Failed to submit pick');
    }
  };

  // Fetch history data when viewing history page
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const jwtModule = await import('jwt-decode');
      const decoded = jwtDecode(token);
      const userId = decoded.id;

      try {
        const res = await fetch('http://localhost:5000/api/picks/history', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setHistory(data.history);
      } catch (err) {
        console.error('Failed to fetch history', err);
      }
    };

    if (currentPage === 'history') {
      fetchHistory();
    }
  }, [currentPage]);

  // Render content based on current page
  const renderContent = () => {
    switch (currentPage) {
      case 'login':
        return (
          <div className="page-content">
            <h2>🔐 Login</h2>
            <div className="login-form">
              <input type="email" placeholder="Email" className="form-input" />
              <input type="password" placeholder="Password" className="form-input" />
              <button className="submit-button" onClick={handleLogin}>Sign In</button>
            </div>
          </div>
        );

      case 'picks':
        return (
          <div className="page-content">
            <h2>🎯 My Picks</h2>
            {successMessage && <div className="success-message">{successMessage}</div>}
            <div className="picks-section">
              <h3>Week {currentWeek} - NFL Games</h3>
              {games.map((game) => (
                <div key={game.id} className="game-card">
                  <div className="game-info">
                    <span className="teams">{game.home_team} vs {game.away_team}</span>
                  </div>
                  {!game.disabled && (
                    <div className="pick-buttons">
                      <button
                        className={`pick-button ${currentPick?.team_id === game.home_team_id ? 'selected' : ''}`}
                        onClick={() => handlePick(game.home_team_id, game.week_number)}
                      >
                        Pick {game.home_team}
                      </button>
                      <button
                        className={`pick-button ${currentPick?.team_id === game.away_team_id ? 'selected' : ''}`}
                        onClick={() => handlePick(game.away_team_id, game.week_number)}
                      >
                        Pick {game.away_team}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'leaderboard':
        return (
          <div className="page-content">
            <h2>🏆 Leaderboard</h2>
            <div className="leaderboard">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.username}
                  className={`leader-item ${
                    index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''
                  }`}
                >
                  <span className="rank">
                    {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}
                  </span>
                  <span className="name">{entry.username}</span>
                  <span className="score">{entry.correct_picks} wins</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="page-content">
            <h2>📈 My Pick History</h2>
            {history.length === 0 ? (
              <p>No pick history yet.</p>
            ) : (
              <div className="history-list">
                {history
                  .sort((a, b) => b.week_number - a.week_number)
                  .map((entry, index) => {
                    console.log('🎯 History Entry:', entry);
                    const isCorrect = entry.team_id === entry.winner_team_id;
                    return (
                      <div key={index} className="history-item">
                        <h4>Week {entry.week_number}</h4>
                        <p>
                          You picked: <strong>{entry.picked_team_name}</strong><br />
                          Game: {entry.home_team_name} vs {entry.away_team_name}<br />
                          Final Score: {entry.home_team_name} {entry.score_home} - {entry.away_team_name} {entry.score_away}<br />
                          Result: <span style={{ color: isCorrect ? 'limegreen' : 'crimson' }}>
                            {isCorrect ? 'Correct ✅' : 'Incorrect ❌'}
                          </span>
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="welcome-section">
            <h2>Welcome to Shotgun Pick'em!</h2>
            <p>Your NFL weekly picks league</p>
          </div>
        );
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🏈 Shotgun Pick'em</h1>
        <nav className="main-nav">
          <button className={`nav-button ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>Home</button>
          <button className={`nav-button ${currentPage === 'login' ? 'active' : ''}`} onClick={() => setCurrentPage('login')}>Login</button>
          <button className={`nav-button ${currentPage === 'leaderboard' ? 'active' : ''}`} onClick={() => setCurrentPage('leaderboard')}>Leaderboard</button>
          <button className={`nav-button ${currentPage === 'picks' ? 'active' : ''}`} onClick={() => setCurrentPage('picks')}>My Picks</button>
          <button className={`nav-button ${currentPage === 'history' ? 'active' : ''}`} onClick={() => setCurrentPage('history')}>History</button>
          {user && (
            <button className="nav-button" onClick={() => {
              localStorage.removeItem('token');
              setUser(null);
              setCurrentPage('login');
            }}>
              Log Out
            </button>
          )}
        </nav>
      </header>

      <main className="main-content">
        {renderContent()}
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 Shotgun Pick'em League</p>
      </footer>
    </div>
  );
}

export default App;
