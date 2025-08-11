import React from 'react';
import LineupCompletenessChecker from './LineupCompletenessChecker';

function App() {
  return (
    <div className="container">
      <header className="header">
        <h1>Sleeper Lineup Completeness Checker</h1>
        <p>Check if your fantasy football lineups are complete and optimized</p>
      </header>
      <LineupCompletenessChecker />
    </div>
  );
}

export default App;
