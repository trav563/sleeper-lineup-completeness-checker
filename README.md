# Sleeper Lineup Completeness Checker

A React application that checks the completeness of your fantasy football lineups on Sleeper.

## Live Demo

Check out the live demo: [Sleeper Lineup Completeness Checker](https://trav563.github.io/sleeper-lineup-completeness-checker/)

## Features

- Fetches the current NFL week from Sleeper
- Loads league users, rosters, and matchups for that week
- Checks each starter's injury status from the /players/nfl dictionary
- Marks teams as:
  - Complete (green) — all starters eligible
  - Potential to be Incomplete (orange) — at least one starter Questionable/Doubtful
  - Incomplete (red) — at least one starter Out/IR/Suspended or on BYE
- Shows dynasty team names and their avatars
- Defaults to a sample League ID (editable input)

## Usage

1. Enter your Sleeper league ID in the input field
2. Press Enter or click "Load"
3. View the status of all teams in your league

## API

This application uses the [Sleeper API](https://docs.sleeper.com/) to fetch data about your fantasy football league.

## Development

### Prerequisites

- Node.js
- npm

### Installation

1. Clone the repository
```
git clone https://github.com/trav563/sleeper-lineup-completeness-checker.git
cd sleeper-lineup-completeness-checker
```

2. Install dependencies
```
npm install
```

3. Start the development server
```
npm start
```

4. Build for production
```
npm run build
```

5. Deploy to GitHub Pages
```
npm run deploy
```

## Notes

- The Sleeper API doesn't expose a simple week-by-week schedule/bye feed.
- The application includes a hardcoded 2025 bye map (source: FantasyAlarm May 14, 2025).
- You can update BYE_MAP_2025 in the code for accuracy each season.

## License

MIT
