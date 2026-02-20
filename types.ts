
export interface Player {
  id: string;
  name: string;
  kills?: number;
}

export interface TeamMatch {
  timestamp: number;
  teamA: string[];
  teamB: string[];
}

export interface PlayerStats {
  kills: number;
  wins: number;
  matches: number;
}

export interface GameState {
  allPlayers: Player[];
  pool: Player[];
  teamA: Player[];
  teamB: Player[];
  currentSpinCount: number;
  isSpinning: boolean;
  roundComplete: boolean;
  history: TeamMatch[];
  pendingWinner: Player | null;
  captains: {
    teamA: Player | null;
    teamB: Player | null;
  } | null;
  ranking: Record<string, PlayerStats>;
  streams: {
    youtubeId: string;
    twitchChannel: string;
  };
  currentMap: string | null;
  musicTrack: number;
}
