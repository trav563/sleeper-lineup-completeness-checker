# Sleeper Lineup Completeness Checker

A React application that checks the completeness of your fantasy football lineups on Sleeper.

## Overview

This tool helps fantasy football managers ensure their lineups are complete and optimized by checking:

- Players on bye weeks
- Injured players
- Empty roster spots
- Players in incorrect positions

## Features

- **League ID Input**: Enter your Sleeper league ID to load your league data
- **Week Selection**: Choose which week to check lineups for
- **Team Overview**: See all teams in your league and their lineup status
- **Status Indicators**: 
  - ✅ OK: Lineup is complete with active players
  - ⚠️ POTENTIAL: Lineup has players who are questionable or on IR
  - ❌ INCOMPLETE: Lineup has empty slots or players on bye

## Technology

- React
- Tailwind CSS
- Sleeper API

## How to Use

1. Enter your Sleeper league ID
2. Select the week you want to check
3. View the status of all lineups in your league
4. Click on a team to see detailed information about their lineup

## API Integration

This application uses the [Sleeper API](https://docs.sleeper.com/) to fetch league, team, and player data.

## Installation

```bash
# Clone the repository
git clone https://github.com/trav563/sleeper-lineup-completeness-checker.git

# Navigate to the project directory
cd sleeper-lineup-completeness-checker

# Install dependencies
npm install

# Start the development server
npm start
```

## License

MIT
