'use client';

import { ScoreDisplay } from '@/components/ScoreDisplay';
import { GameState, User } from '@/lib/types';
import { assignTeam, generateId, generateUsername } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function HomePage() {
  // Initialize as null to ensure server and client match on first render
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingName, setPendingName] = useState<string>('');
  const [clientIp, setClientIp] = useState<string | undefined>(undefined);
  const userRef = useRef<User | null>(user);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    blueScore: 0,
    redScore: 0,
    totalTaps: 0,
    activeUsers: 0,
    lastUpdated: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();

  // Rehydrate user from localStorage after mount (avoid hydration mismatch)
  useEffect(() => {
    // These setState calls in useEffect are intentional to avoid hydration mismatch
    // - localStorage is only available client-side
    // - generateUsername() uses Math.random() which differs between server and client
    try {
      const saved = localStorage.getItem('sw_user');
      if (saved) {
        const loadedUser = JSON.parse(saved) as User;
        setUser(loadedUser);
        console.log('Loaded user from localStorage:', loadedUser.username, 'Taps:', loadedUser.tapCount);
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
    setPendingName(generateUsername());
    // Set loading to false after a brief delay to show loading state
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  // Sync userRef with user state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch client meta (IP) and setup cross-tab sync
  useEffect(() => {
    fetch('/api/client-info')
      .then(r => r.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp(undefined));

    // Setup cross-tab sync
    const bc = new BroadcastChannel('sw_channel');
    channelRef.current = bc;
    bc.onmessage = (ev) => {
      if (ev?.data?.type === 'tap' && ev.data?.userId && userRef.current && ev.data.userId === userRef.current.id) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, tapCount: ev.data.tapCount };
          // Save to localStorage to persist tap count across tabs
          try { localStorage.setItem('sw_user', JSON.stringify(updated)); } catch { }
          return updated;
        });
      }
      if (ev?.data?.type === 'user_update' && ev.data?.user) {
        const incoming: User = ev.data.user;
        setUser(prev => (prev && prev.id === incoming.id) ? incoming : prev);
      }
    };

    return () => {
      bc.close();
    };
  }, []);

  // When user is set, persist, announce to other tabs, and open websocket
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
        // Handle both old format (just gameState) and new format (gameState + user)
        if (message.data.gameState) {
          setGameState(message.data.gameState);
          // If this update includes the current user's data, sync it
          if (message.data.user && message.data.user.id === userRef.current?.id) {
            setUser(prev => {
              if (!prev) return prev;
              // Use the maximum tap count to preserve localStorage data
              const serverTapCount = message.data.user.tapCount;
              const localTapCount = prev.tapCount;
              const finalTapCount = Math.max(serverTapCount, localTapCount);

              const updated = {
                ...prev,
                tapCount: finalTapCount,
                lastTapTime: message.data.user.lastTapTime
              };
              // Save to localStorage to persist tap count
              try { localStorage.setItem('sw_user', JSON.stringify(updated)); } catch { }
              // console.log(`Tap count synced - Local: ${localTapCount}, Server: ${serverTapCount}, Final: ${finalTapCount}`);
              return updated;
            });
          }
        } else {
          // Old format - just gameState
          setGameState(message.data);
        }
      }
    };

    websocket.onclose = () => setIsConnected(false);
    websocket.onerror = () => setIsConnected(false);

    return () => websocket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist user to localStorage and broadcast to other tabs whenever it changes
  useEffect(() => {
    if (!user) return;
    try { localStorage.setItem('sw_user', JSON.stringify(user)); } catch { }
    channelRef.current?.postMessage({ type: 'user_update', user });
  }, [user]);

  // Keep tap count in sync when other tabs/users update via broadcast
  // (no polling needed - WebSocket already sends game_update)

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
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, tapCount: prev.tapCount + 1, lastTapTime: Date.now() };
          try { localStorage.setItem('sw_user', JSON.stringify(updated)); } catch { }
          channelRef.current?.postMessage({ type: 'tap', userId: updated.id, tapCount: updated.tapCount });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error sending tap:', error);
    }
  };

  const goToLeaderboard = () => {
    router.push('/leaderboard');
  };

  const handleChangeUser = () => {
    try { localStorage.removeItem('sw_user'); } catch { }
    // Force username modal and cleanup ws via effect cleanup
    setUser(null);
  };

  const [tapEffect, setTapEffect] = useState(false);
  const [tapPosition, setTapPosition] = useState({ x: 0, y: 0 });
  const tapInProgressRef = useRef(false);

  const startSession = () => {
    const sessionId = generateId();
    const team = assignTeam();
    const newUser: User = {
      id: generateId(),
      username: (pendingName || '').trim() || generateUsername(),
      team,
      sessionId,
      tapCount: 0,
      lastTapTime: Date.now(),
      meta: {
        ip: clientIp,
        userAgent: navigator.userAgent || '',
        language: navigator.language,
      },
    };
    try {
      localStorage.setItem('sw_user', JSON.stringify(newUser));
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
    setUser(newUser);
  };

  // Show loading state with main window skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex flex-col">
        {/* Top Bar Skeleton */}
        <motion.div
          className="flex-none backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="container max-w-2xl mx-auto px-5 py-3.5">
            <div className="flex items-center justify-between gap-4">
              {/* User Info Skeleton */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                <div>
                  <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-1" />
                  <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>

              {/* Tap Count Skeleton */}
              <div className="text-center shrink-0">
                <div className="h-7 w-16 bg-slate-200 rounded animate-pulse mb-1" />
                <div className="h-2.5 w-16 bg-slate-200 rounded animate-pulse" />
              </div>

              {/* Buttons Skeleton */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-7 w-16 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-7 w-16 bg-slate-900/20 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Section Skeleton */}
        <div className="flex-none container max-w-2xl mx-auto px-5 py-5 space-y-4">
          {/* Score Display Skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50">
              <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50">
              <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50">
              <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50">
              <div className="h-8 w-20 bg-slate-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Tap Area Skeleton */}
        <div className="relative flex-1 bg-linear-to-br from-slate-300 to-slate-400 flex items-center justify-center">
          <motion.div
            className="text-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-white/80 text-4xl font-black mb-3 tracking-tighter">
              LOADING
            </div>
            <div className="inline-flex items-center gap-2 text-white/70 text-base font-medium">
              <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
              Setting up...
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show username input if no user is logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <motion.div
          className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-6 border border-slate-200/60 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-slate-900 text-xl font-bold mb-2">Choose a username</div>
          <div className="text-slate-500 text-sm mb-4">You can change it anytime by refreshing.</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startSession();
            }}
          >
            <input
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              placeholder="Enter a username"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/50 focus:border-slate-400"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  startSession();
                }
              }}
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-slate-900 text-white font-semibold py-2.5 hover:bg-slate-800 transition-colors"
            >
              Start
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const teamGradient = user.team === 'blue'
    ? 'from-sky-400 to-blue-400'
    : 'from-rose-400 to-pink-400';

  const handleTapWithEffect = (e: React.PointerEvent) => {
    if (!isConnected) return;

    // Prevent duplicate taps (both touch and click events can fire)
    if (tapInProgressRef.current) return;

    tapInProgressRef.current = true;
    setTimeout(() => {
      tapInProgressRef.current = false;
    }, 100);

    // Get tap position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTapPosition({ x, y });
    setTapEffect(true);
    setTimeout(() => setTapEffect(false), 600);

    handleTap();
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Top Section - Elegant Header */}
      <motion.div
        className="flex-none backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="container max-w-2xl mx-auto px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* User Info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'} shrink-0`} />
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-base tracking-tight truncate">{user.username}</div>
                <div className="text-xs font-medium">
                  <span className={`${user.team === 'blue' ? 'text-sky-600' : 'text-rose-600'}`}>
                    Team {user.team === 'blue' ? 'Blue' : 'Red'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tap Count */}
            <motion.div
              className="text-center shrink-0"
              key={user.tapCount}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <div className={`text-2xl font-bold bg-linear-to-br ${teamGradient} bg-clip-text text-transparent`}>
                {user.tapCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-medium tracking-wide">YOUR TAPS</div>
            </motion.div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                onClick={handleChangeUser}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold hover:bg-slate-100 transition-colors border border-slate-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Change
              </motion.button>
              <motion.button
                onClick={goToLeaderboard}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
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
        className={`relative flex-1 bg-linear-to-br ${teamGradient} ${!isConnected ? 'opacity-50' : 'cursor-pointer'} flex items-center justify-center select-none overflow-hidden touch-none`}
        onPointerDown={handleTapWithEffect}
        whileTap={isConnected ? { scale: 0.98 } : {}}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/10 to-transparent" />

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