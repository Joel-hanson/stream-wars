'use client';

import { GameState, LeaderboardEntry } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, Medal, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [gameState, setGameState] = useState<GameState>({
        blueScore: 0,
        redScore: 0,
        totalTaps: 0,
        activeUsers: 0,
        lastUpdated: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const router = useRouter();

    const fetchGameData = async () => {
        try {
            const response = await fetch('/api/game-state', { cache: 'no-store' });
            const data = await response.json();

            setGameState(data.gameState);

            // Use leaderboard data (includes offline users)
            const leaderboardData: LeaderboardEntry[] = data.leaderboard
                .slice(0, 50)
                .map((user: { username: string; team: string; tapCount: number }, index: number) => ({
                    username: user.username,
                    team: user.team as 'blue' | 'red',
                    tapCount: user.tapCount,
                    rank: index + 1,
                }));

            setLeaderboard(leaderboardData);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching game data:', error);
            setIsLoading(false);
        }
    };

    // Initial data load
    useEffect(() => {
        fetchGameData();
    }, []);

    // Connect to WebSocket for real-time updates
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
        const websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            setIsConnected(true);
            console.log('Leaderboard WebSocket connected');
        };

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'game_update' && message.data.gameState) {
                // Update game state from WebSocket
                setGameState(message.data.gameState);
                // Refetch leaderboard data when game state changes
                fetchGameData();
            }
        };

        websocket.onclose = () => {
            setIsConnected(false);
            console.log('Leaderboard WebSocket disconnected');
        };

        websocket.onerror = () => {
            setIsConnected(false);
            console.error('Leaderboard WebSocket error');
        };

        return () => websocket.close();
    }, []);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Trophy className="w-6 h-6 text-yellow-500" />;
            case 2:
                return <Medal className="w-6 h-6 text-gray-400" />;
            case 3:
                return <Award className="w-6 h-6 text-amber-600" />;
            default:
                return <span className="w-6 h-6 flex items-center justify-center text-white/70 font-bold">#{rank}</span>;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-slate-400 text-lg font-medium"
                >
                    Loading...
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100">
            {/* Header */}
            <motion.div
                className="backdrop-blur-xl bg-white/80 border-b border-slate-200/50 shadow-sm"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <div className="container max-w-2xl mx-auto px-5 py-4">
                    <div className="flex items-center justify-between">
                        <motion.button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
                            whileHover={{ x: -4 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </motion.button>

                        <div className="text-slate-900 text-xl font-bold tracking-tight">Leaderboard</div>

                        <div className="w-16"></div>
                    </div>
                </div>
            </motion.div>

            {/* Main Content */}
            <div className="container max-w-2xl mx-auto px-5 py-5 space-y-4">
                {/* Game Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <motion.div
                        className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50 shadow-sm"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="text-xs font-semibold text-slate-500 mb-1 tracking-wide uppercase">Team Blue</div>
                        <div className="text-4xl font-black bg-linear-to-br from-sky-500 to-blue-500 bg-clip-text text-transparent">
                            {formatNumber(gameState.blueScore)}
                        </div>
                    </motion.div>
                    <motion.div
                        className="bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50 shadow-sm"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        <div className="text-xs font-semibold text-slate-500 mb-1 tracking-wide uppercase">Team Red</div>
                        <div className="text-4xl font-black bg-linear-to-br from-rose-500 to-pink-500 bg-clip-text text-transparent">
                            {formatNumber(gameState.redScore)}
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <motion.div
                        className="bg-white/90 backdrop-blur rounded-2xl p-3 border border-slate-200/50 shadow-sm"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="text-3xl font-bold text-slate-900">{gameState.activeUsers}</div>
                        <div className="text-xs text-slate-500 font-medium tracking-wide">PLAYERS ONLINE</div>
                    </motion.div>
                    <motion.div
                        className="bg-white/90 backdrop-blur rounded-2xl p-3 border border-slate-200/50 shadow-sm"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                    >
                        <div className="text-3xl font-bold text-slate-900">{formatNumber(gameState.totalTaps)}</div>
                        <div className="text-xs text-slate-500 font-medium tracking-wide">TOTAL TAPS</div>
                    </motion.div>
                </div>

                {/* Leaderboard */}
                <motion.div
                    className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="p-4 border-b border-slate-200/50">
                        <h2 className="text-slate-900 text-base font-bold tracking-tight">Top Players</h2>
                    </div>

                    <div className="divide-y divide-slate-200/50">
                        {leaderboard.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                No players yet
                            </div>
                        ) : (
                            leaderboard.map((entry, index) => {
                                const teamGradient = entry.team === 'blue'
                                    ? 'from-sky-400 to-blue-400'
                                    : 'from-rose-400 to-pink-400';
                                const teamColor = entry.team === 'blue' ? 'text-sky-600' : 'text-rose-600';

                                return (
                                    <motion.div
                                        key={entry.username}
                                        className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + (index * 0.05) }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8">
                                                {entry.rank <= 3 ? (
                                                    getRankIcon(entry.rank)
                                                ) : (
                                                    <span className="text-slate-400 font-bold text-sm">#{entry.rank}</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-2xl bg-linear-to-br ${teamGradient} flex items-center justify-center shadow-lg shadow-${entry.team === 'blue' ? 'blue' : 'red'}-500/25`}>
                                                    <span className="text-white font-bold text-sm">
                                                        {entry.team === 'blue' ? 'B' : 'R'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <div className="font-semibold text-slate-900 text-sm tracking-tight">{entry.username}</div>
                                                    <div className={`text-xs font-semibold ${teamColor} tracking-wide`}>
                                                        TEAM {entry.team.toUpperCase()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-slate-900">
                                                {entry.tapCount.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium tracking-wide">TAPS</div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </motion.div>

                <div className="pb-6"></div>
            </div>
        </div>
    );
}
