
import React, { useState, useEffect } from 'react';
import { Wheel } from './components/Wheel';
import { PlayerInput } from './components/PlayerInput';
import { Player, GameState, TeamMatch } from './types';
import { audioService } from './services/audioService';
import { Music, Music2, RefreshCcw, Trophy, Users, LayoutGrid, Share2, History, CheckCircle2, ArrowRight, UserPlus, Mic, MicOff, Volume2, Crown, Youtube, Twitch, Map, Settings, Play, ListOrdered, BarChart3 } from 'lucide-react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { GoogleGenAI, Modality } from "@google/genai";
import confetti from 'canvas-confetti';

const COD_MAPS = ["Rust", "Shipment", "Shoot House", "Nuketown", "Highrise", "Terminal", "Favela", "Scrapyard"];

const extractYoutubeId = (input: string) => {
  if (!input) return '';
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/embed\/|\/v\/))([^?&"'>]+)/);
  return match ? match[1] : input;
};

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const { isActive: isAiActive, isSpeaking: isAiSpeaking, start: startAi, stop: stopAi, sendEvent } = useGeminiLive();
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempKills, setTempKills] = useState<Record<string, number>>({});
  const [winningTeam, setWinningTeam] = useState<'A' | 'B' | null>(null);
  const [matchType, setMatchType] = useState<'Odnowa' | 'BR'>('Odnowa');
  const [showRankingInput, setShowRankingInput] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    allPlayers: [],
    pool: [],
    teamA: [],
    teamB: [],
    currentSpinCount: 0,
    isSpinning: false,
    roundComplete: false,
    history: JSON.parse(localStorage.getItem('team_fortune_history') || '[]'),
    pendingWinner: null,
    captains: null,
    ranking: JSON.parse(localStorage.getItem('team_fortune_ranking') || '{}'),
    streams: { youtubeId: '', twitchChannel: '' },
    currentMap: null,
    musicTrack: 0
  });

  const announceName = async (name: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Wylosowano: ${name}.` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
      }
    } catch (err) { console.error(err); }
  };

  const handleAddPlayer = (name: string) => {
    setPlayers(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name }]);
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const saveRanking = () => {
    if (!winningTeam) {
      alert("Wybierz zwycięską drużynę!");
      return;
    }

    setGameState(prev => {
      const newRanking = { ...prev.ranking };
      
      // Update all players who participated in the round
      const participants = [...prev.teamA, ...prev.teamB];
      participants.forEach(player => {
        if (!newRanking[player.id]) {
          newRanking[player.id] = { kills: 0, wins: 0, matches: 0 };
        }
        
        const stats = newRanking[player.id];
        stats.kills += (tempKills[player.id] || 0);
        stats.matches += 1;
        
        const isWinner = (winningTeam === 'A' && prev.teamA.some(p => p.id === player.id)) ||
                         (winningTeam === 'B' && prev.teamB.some(p => p.id === player.id));
        
        if (isWinner) {
          stats.wins += 1;
        }
      });

      localStorage.setItem('team_fortune_ranking', JSON.stringify(newRanking));
      return { ...prev, ranking: newRanking };
    });
    setShowRankingInput(false);
    setTempKills({});
    setWinningTeam(null);
    startRound();
  };

  const startRound = () => {
    setGameState(prev => ({
      ...prev,
      allPlayers: [...players],
      pool: [...players],
      teamA: [],
      teamB: [],
      currentSpinCount: 0,
      roundComplete: false,
      pendingWinner: null,
      captains: null,
      currentMap: COD_MAPS[Math.floor(Math.random() * COD_MAPS.length)]
    }));
    if (isAiActive) sendEvent("Zaczynamy nową rundę!");
  };

  const confirmSelection = () => {
    const winner = gameState.pendingWinner;
    if (!winner) return;
    setGameState(prev => {
      const nextSpinCount = prev.currentSpinCount + 1;
      const newTeamA = [...prev.teamA, winner];
      const newPool = prev.pool.filter(p => p.id !== winner.id);
      let newRoundComplete = false;
      let newTeamB = prev.teamB;
      if (nextSpinCount === 4) {
        newRoundComplete = true;
        newTeamB = [...newPool];
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      return { ...prev, pool: newPool, teamA: newTeamA, teamB: newTeamB, currentSpinCount: nextSpinCount, roundComplete: newRoundComplete, pendingWinner: null };
    });
  };

  const selectCaptains = () => {
    const capA = gameState.teamA[Math.floor(Math.random() * 4)];
    const capB = gameState.teamB[Math.floor(Math.random() * 4)];
    setGameState(prev => ({ ...prev, captains: { teamA: capA, teamB: capB } }));
  };

  const currentOrigin = window.location.origin;
  const currentHostname = window.location.hostname;

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col items-center bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-x-hidden">
      {/* Header */}
      <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg animate-pulse">
            <BarChart3 className="text-white" size={28} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bungee tracking-tighter text-white">COD FORTUNE HUB</h1>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-slate-400 transition-all border border-slate-700" title="Ustawienia">
            <Settings size={20} />
          </button>
          <button onClick={isAiActive ? stopAi : startAi} className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold ${isAiActive ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
            {isAiActive ? <Mic className={isAiSpeaking ? 'animate-bounce' : ''} size={18} /> : <MicOff size={18} />}
            <span className="hidden sm:inline">AI Komentator</span>
          </button>
          <button onClick={() => { setIsMusicPlaying(!isMusicPlaying); audioService.toggleMusic(!isMusicPlaying); }} className={`p-3 rounded-xl border ${isMusicPlaying ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
            {isMusicPlaying ? <Music size={20} /> : <Music2 size={20} />}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stats & Settings */}
        <div className="lg:col-span-3 space-y-6">
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-indigo-500/30 animate-in slide-in-from-left duration-300">
              <h3 className="text-white font-bungee text-sm mb-4">Ustawienia Streamu</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                  <Youtube size={16} className="text-rose-500" />
                  <input 
                    placeholder="YouTube URL lub ID" 
                    className="bg-transparent text-xs outline-none w-full" 
                    value={gameState.streams.youtubeId} 
                    onChange={e => setGameState({...gameState, streams: {...gameState.streams, youtubeId: extractYoutubeId(e.target.value)}})} 
                  />
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                  <Twitch size={16} className="text-purple-500" />
                  <input 
                    placeholder="Nazwa kanału Twitch" 
                    className="bg-transparent text-xs outline-none w-full" 
                    value={gameState.streams.twitchChannel} 
                    onChange={e => setGameState({...gameState, streams: {...gameState.streams, twitchChannel: e.target.value}})} 
                  />
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Wybierz Muzykę</label>
                  <div className="flex gap-2 mt-2">
                    {[0,1,2].map(i => (
                      <button key={i} onClick={() => { audioService.changeTrack(i); setGameState({...gameState, musicTrack: i}); }} className={`flex-1 p-2 rounded-lg text-[10px] font-bold ${gameState.musicTrack === i ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                        T#{i+1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ranking MVP */}
          <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bungee text-sm flex items-center gap-2">
                <Trophy size={16} className="text-yellow-400" /> KLASYFIKACJA OGÓLNA
              </h3>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {Object.entries(gameState.ranking)
                .sort((a, b) => {
                  // Sort by wins first, then kills
                  if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
                  return b[1].kills - a[1].kills;
                })
                .map(([id, stats]) => {
                  const player = players.find(p => p.id === id) || { name: 'Gracz' };
                  const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
                  return (
                    <div key={id} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{player.name}</span>
                        <div className="flex items-center gap-1">
                          <Crown size={10} className="text-yellow-500" />
                          <span className="text-yellow-500 font-bungee text-[10px]">{stats.wins} W</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <div className="flex gap-3">
                          <span>KILLS: <span className="text-indigo-400 font-bold">{stats.kills}</span></span>
                          <span>MECZE: <span className="text-slate-200 font-bold">{stats.matches}</span></span>
                        </div>
                        <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold">WR: {winRate}%</span>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(gameState.ranking).length === 0 && <p className="text-[10px] text-slate-500 italic text-center py-4">Brak danych bojowych</p>}
            </div>
          </div>

          <PlayerInput players={players} onAdd={handleAddPlayer} onRemove={handleRemovePlayer} disabled={gameState.pool.length > 0 && !gameState.roundComplete} />
        </div>

        {/* Center: Wheel & Streams */}
        <div className="lg:col-span-6 flex flex-col items-center gap-6">
          {/* Top Info Bar */}
          <div className="w-full flex justify-between gap-4">
             {gameState.currentMap && (
               <div className="flex-1 bg-slate-800/80 p-3 rounded-2xl border border-indigo-500/30 flex items-center justify-center gap-3 animate-in zoom-in">
                  <Map className="text-indigo-400" size={20} />
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Aktualna Mapa</p>
                    <p className="text-lg font-bungee text-white">{gameState.currentMap}</p>
                  </div>
               </div>
             )}
             {isAiActive && (
               <div className="flex-1 bg-indigo-600/10 border border-indigo-500/40 p-3 rounded-2xl flex items-center justify-center gap-2 text-indigo-300">
                  <div className={`w-2 h-2 rounded-full ${isAiSpeaking ? 'bg-indigo-400 animate-ping' : 'bg-indigo-600 animate-pulse'}`}></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{isAiSpeaking ? 'AI Mówi' : 'AI Słucha'}</span>
               </div>
             )}
          </div>

          <div className="relative">
            {gameState.pendingWinner && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md rounded-[40px] animate-in zoom-in">
                <div className="text-center p-8">
                  <UserPlus className="text-indigo-500 mx-auto mb-4" size={48} />
                  <h2 className="text-white font-bungee text-3xl mb-4">{gameState.pendingWinner.name}</h2>
                  <p className="text-slate-400 mb-8 italic">Zrekrutowany do Teamu A</p>
                  <button onClick={confirmSelection} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bungee shadow-2xl flex items-center gap-2 mx-auto">
                    POTWIERDŹ <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}
            
            {gameState.pool.length > 0 && !gameState.roundComplete ? (
              <Wheel players={gameState.pool} isSpinning={gameState.isSpinning} onSpinStart={() => setGameState({...gameState, isSpinning: true})} onSpinEnd={(w) => { setGameState({...gameState, isSpinning: false, pendingWinner: w}); announceName(w.name); }} />
            ) : !gameState.roundComplete ? (
               <div className="flex flex-col items-center justify-center aspect-square w-full max-w-md bg-slate-800/20 border-4 border-dashed border-slate-800 rounded-full text-center p-10">
                  <Play className="text-slate-700 mb-4" size={64} />
                  <h3 className="font-bungee text-slate-500 text-xl">GOTOWY DO ZARZUTU?</h3>
                  {players.length === 8 ? (
                    <button onClick={() => setShowRankingInput(true)} className="mt-6 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bungee shadow-xl">ROZPOCZNIJ RUNDĘ</button>
                  ) : <p className="text-slate-600 mt-2">Dodaj {8 - players.length} graczy</p>}
               </div>
            ) : (
              <div className="text-center p-10 animate-in zoom-in">
                <Trophy className="text-yellow-500 mx-auto mb-4" size={80} />
                <h2 className="text-4xl font-bungee text-white mb-6">SKŁADY GOTOWE!</h2>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => setShowRankingInput(true)} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bungee">REWANŻ</button>
                  <button onClick={() => setPlayers([])} className="px-8 py-4 bg-slate-800 text-slate-400 rounded-2xl font-bungee">RESET</button>
                </div>
              </div>
            )}
          </div>

          {/* Streams Grid */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {gameState.streams.youtubeId && (
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-rose-500/20">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${gameState.streams.youtubeId}?origin=${currentOrigin}&enablejsapi=1&autoplay=0&mute=0`} 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            {gameState.streams.twitchChannel && (
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-purple-500/20">
                <iframe 
                  src={`https://player.twitch.tv/?channel=${gameState.streams.twitchChannel}&parent=${currentHostname}&autoplay=false`} 
                  height="100%" 
                  width="100%" 
                  allowFullScreen
                ></iframe>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Teams & Ranking Input Overlay */}
        <div className="lg:col-span-3 space-y-6">
          {(gameState.roundComplete || gameState.teamA.length > 0) && (
            <div className="space-y-4">
              <div className="bg-indigo-900/20 border border-indigo-500/30 p-5 rounded-2xl">
                <h4 className="text-indigo-400 font-bungee text-sm mb-3 flex items-center justify-between">TEAM A {gameState.captains?.teamA && <Crown size={14} className="text-yellow-500" />}</h4>
                <div className="grid gap-2">
                  {gameState.teamA.map(p => <div key={p.id} className={`p-2 rounded-lg text-xs font-bold border ${gameState.captains?.teamA?.id === p.id ? 'bg-yellow-500/10 border-yellow-500 text-yellow-200' : 'bg-slate-900/60 border-slate-700 text-slate-300'}`}>{p.name}</div>)}
                </div>
              </div>
              {gameState.roundComplete && (
                <>
                  <div className="bg-rose-900/20 border border-rose-500/30 p-5 rounded-2xl">
                    <h4 className="text-rose-400 font-bungee text-sm mb-3 flex items-center justify-between">TEAM B {gameState.captains?.teamB && <Crown size={14} className="text-yellow-500" />}</h4>
                    <div className="grid gap-2">
                      {gameState.teamB.map(p => <div key={p.id} className={`p-2 rounded-lg text-xs font-bold border ${gameState.captains?.teamB?.id === p.id ? 'bg-yellow-500/10 border-yellow-500 text-yellow-200' : 'bg-slate-900/60 border-slate-700 text-slate-300'}`}>{p.name}</div>)}
                    </div>
                  </div>
                  {!gameState.captains && (
                    <button onClick={selectCaptains} className="w-full p-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-bungee text-xs shadow-lg">LOSUJ KAPITANÓW</button>
                  )}
                  <button onClick={() => { navigator.clipboard.writeText(`Mapa: ${gameState.currentMap}\nA: ${gameState.teamA.map(p=>p.name).join(',')}\nB: ${gameState.teamB.map(p=>p.name).join(',')}`); setShowCopyTooltip(true); setTimeout(()=>setShowCopyTooltip(false), 2000); }} className="w-full p-4 bg-slate-800 text-slate-300 rounded-2xl font-bungee text-xs border border-slate-700">
                    {showCopyTooltip ? 'SKOPIOWANO!' : 'KOPIUJ SKŁADY'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Ranking Input Modal */}
          {showRankingInput && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
              <div className="bg-slate-900 border border-indigo-500/30 p-6 md:p-8 rounded-3xl w-full max-w-2xl animate-in fade-in zoom-in duration-300">
                <h3 className="text-white font-bungee text-xl mb-6 text-center">RAPORT PO BITEWNY</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: Match Info */}
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block">Tryb Gry</label>
                      <div className="flex gap-2">
                        {['Odnowa', 'BR'].map(type => (
                          <button 
                            key={type}
                            onClick={() => setMatchType(type as any)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bungee border transition-all ${matchType === type ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block">Zwycięska Drużyna</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setWinningTeam('A')}
                          className={`flex-1 py-3 rounded-xl text-xs font-bungee border transition-all ${winningTeam === 'A' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                          TEAM A
                        </button>
                        <button 
                          onClick={() => setWinningTeam('B')}
                          className={`flex-1 py-3 rounded-xl text-xs font-bungee border transition-all ${winningTeam === 'B' ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                          TEAM B
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Podsumowanie</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-white">Mapa: <span className="text-indigo-400">{gameState.currentMap}</span></span>
                        <span className="text-xs text-white">Tryb: <span className="text-indigo-400">{matchType}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Kills Input */}
                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 uppercase font-bold block">Eliminacje (Kills)</label>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {players.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-6 rounded-full ${gameState.teamA.some(tp => tp.id === p.id) ? 'bg-indigo-500' : 'bg-rose-500'}`}></div>
                            <span className="text-sm font-bold text-slate-200">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              placeholder="0"
                              className="w-16 bg-slate-950 border border-slate-600 rounded-lg p-2 text-center text-indigo-400 outline-none focus:border-indigo-500 transition-colors" 
                              onChange={e => setTempKills({...tempKills, [p.id]: Number(e.target.value)})} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-slate-800">
                   <button onClick={saveRanking} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bungee shadow-xl hover:bg-indigo-500 transition-all transform hover:scale-[1.02] active:scale-[0.98]">ZAPISZ WYNIKI</button>
                   <button onClick={() => { setShowRankingInput(false); startRound(); }} className="flex-1 py-4 bg-slate-800 text-slate-400 rounded-2xl font-bungee hover:bg-slate-700 transition-all">POMIŃ</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 w-full max-w-7xl border-t border-slate-800 pt-8 flex justify-between items-center text-[10px] text-slate-600 uppercase tracking-widest pb-10">
        <p>Hub Operacyjny Call of Duty v2.0</p>
        <p>Zasilane przez Gemini AI & Stream Hub</p>
      </footer>
    </div>
  );
};

export default App;
