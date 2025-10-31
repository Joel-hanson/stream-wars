'use client';

import { ScoreDisplay } from '@/components/ScoreDisplay';
import { GameState, User } from '@/lib/types';
import { assignTeam, generateUsername } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [pendingName, setPendingName] = useState<string>(generateUsername());
  const [clientIp, setClientIp] = useState<string | undefined>(undefined);
  const [clientUA, setClientUA] = useState<string>('');
  const [gameState, setGameState] = useState<GameState>({
    blueScore: 0,
    redScore: 0,
    totalTaps: 0,
    activeUsers: 0,
    lastUpdated: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();

  // Fetch client meta (IP and UA)
  useEffect(() => {
    setClientUA(navigator.userAgent || '');
    fetch('/api/client-info')
      .then(r => r.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp(undefined));
  }, []);

  // When user is set, open websocket and announce join
  useEffect(() => {
    if (!user) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      setIsConnected(true);
      websocket.send(JSON.stringify({
        type: 'user_join',
        data: user,
      }));
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'game_update') {
        setGameState(message.data);
      }
    };

    websocket.onclose = () => setIsConnected(false);
    websocket.onerror = () => setIsConnected(false);

    return () => websocket.close();
  }, [user]);

  const handleTap = async () => {
    if (!user || !isConnected) return;

    try {
      const response = await fetch('/api/tap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          team: user.team,
          sessionId: user.sessionId,
        }),
      });

      if (response.ok) {
        // Update local user tap count immediately for better UX
        setUser(prev => prev ? { ...prev, tapCount: prev.tapCount + 1 } : null);
      }
    } catch (error) {
      console.error('Error sending tap:', error);
    }
  };

  const goToLeaderboard = () => {
    router.push('/leaderboard');
  };

  const [tapEffect, setTapEffect] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });

  const startSession = () => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    const team = assignTeam();
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username: (pendingName || '').trim() || generateUsername(),
      team,
      sessionId,
      tapCount: 0,
      lastTapTime: Date.now(),
      meta: {
        ip: clientIp,
        userAgent: clientUA,
        language: navigator.language,
      },
    };
    setUser(newUser);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="text-slate-900 text-xl font-bold mb-2">Choose a username</div>
          <div className="text-slate-500 text-sm mb-4">You can change it anytime by refreshing.</div>
          <input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="Enter a username"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/50 focus:border-slate-400"
          />
          <button
            onClick={startSession}
            className="mt-4 w-full rounded-xl bg-slate-900 text-white font-semibold py-2.5 hover:bg-slate-800 transition-colors"
          >
            Start
          </button>
          <div className="mt-3 text-xs text-slate-500">
            We’ll capture basic device info to improve fairness (IP, browser).
          </div>
        </div>
      </div>
    );
  }

  const teamGradient = user.team === 'blue'
    ? 'from-sky-400 to-blue-400'
    : 'from-rose-400 to-pink-400';
  const teamAccent = user.team === 'blue' ? 'sky' : 'rose';

  const handleTapWithEffect = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isConnected) return;

    // Get tap position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    setTapPosition({ x, y });
    setTapEffect(true);
    setTimeout(() => setTapEffect(false), 600);

    handleTap();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Top Section - Elegant Header */}
      <motion.div
        className="flex-none backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="container max-w-2xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-3">
              <motion.div
                className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${teamGradient} shadow-lg shadow-${teamAccent}-500/25 flex items-center justify-center`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-white font-bold text-sm tracking-tight">
                  {user.team === 'blue' ? 'B' : 'R'}
                </span>
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'} ring-2 ring-white shadow-sm`} />
              </motion.div>
              <div>
                <div className="font-semibold text-slate-900 text-base tracking-tight">{user.username}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className={`${user.team === 'blue' ? 'text-sky-600' : 'text-rose-600'}`}>
                    Team {user.team === 'blue' ? 'Blue' : 'Red'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tap Count & Leaderboard */}
            <div className="flex items-center gap-4">
              <motion.div
                className="text-right"
                key={user.tapCount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <div className={`text-3xl font-bold bg-gradient-to-br ${teamGradient} bg-clip-text text-transparent`}>
                  {user.tapCount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 font-medium tracking-wide">TAPS</div>
              </motion.div>
              <motion.button
                onClick={goToLeaderboard}
                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Board
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Section */}
      <div className="flex-none container max-w-2xl mx-auto px-5 py-5 space-y-4">
        <ScoreDisplay gameState={gameState} />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow"
            whileHover={{ y: -2 }}
          >
            <div className="text-3xl font-bold text-slate-900">{gameState.activeUsers}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5 tracking-wide">PLAYERS ONLINE</div>
          </motion.div>
          <motion.div
            className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow"
            whileHover={{ y: -2 }}
          >
            <div className="text-3xl font-bold text-slate-900">{gameState.totalTaps.toLocaleString()}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5 tracking-wide">TOTAL TAPS</div>
          </motion.div>
        </div>
      </div>

      {/* Tap Area - Interactive Zone */}
      <motion.div
        className={`relative flex-1 bg-gradient-to-br ${teamGradient} ${!isConnected ? 'opacity-50' : 'cursor-pointer'} flex items-center justify-center select-none overflow-hidden`}
        onClick={handleTapWithEffect}
        onTouchStart={handleTapWithEffect}
        whileTap={isConnected ? { scale: 0.98 } : {}}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

        {/* Tap Effect Ripple */}
        <AnimatePresence>
          {tapEffect && (
            <motion.div
              className="absolute w-32 h-32 rounded-full bg-white/30 pointer-events-none"
              style={{
                left: tapPosition.x - 64,
                top: tapPosition.y - 64,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Main Content */}
        <motion.div
          className="relative z-10 text-center px-6"
          animate={isConnected ? {
            scale: [1, 1.02, 1],
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <motion.div
            className="text-white text-5xl font-black mb-3 tracking-tighter drop-shadow-lg"
            animate={{
              opacity: isConnected ? [1, 0.9, 1] : 1
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {isConnected ? 'TAP' : 'CONNECTING'}
          </motion.div>
          <motion.div
            className="text-white/90 text-lg font-medium tracking-wide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isConnected ? 'Tap anywhere to score' : 'Please wait...'}
          </motion.div>

          {isConnected && (
            <motion.div
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Live
            </motion.div>
          )}
        </motion.div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-black/5 rounded-full blur-3xl" />
        </div>
      </motion.div>
    </div>
  );
}