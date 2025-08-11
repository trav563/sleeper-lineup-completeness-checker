import React from 'react';
import LineupCompletenessChecker from './LineupCompletenessChecker';

function App() {
  return (
    <div className="max-w-6xl mx-auto p-4">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Sleeper Lineup Completeness Checker</h1>
        <p className="text-gray-600">Check if your fantasy football lineups are complete and optimized</p>
      </header>
      <LineupCompletenessChecker />
    </div>
  );
}

export default App;
