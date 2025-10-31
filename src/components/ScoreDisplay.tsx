'use client';

import { GameState } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ScoreDisplayProps {
    gameState: GameState;
}

export function ScoreDisplay({ gameState }: ScoreDisplayProps) {
    const totalScore = gameState.blueScore + gameState.redScore;
    const bluePercentage = totalScore > 0 ? (gameState.blueScore / totalScore) * 100 : 50;
    const redPercentage = totalScore > 0 ? (gameState.redScore / totalScore) * 100 : 50;

    const isBlueWinning = gameState.blueScore > gameState.redScore;
    const isRedWinning = gameState.redScore > gameState.blueScore;

    return (
        <div className="space-y-3">
            {/* Team Scores */}
            <div className="grid grid-cols-2 gap-3">
                {/* Blue Team */}
                <motion.div
                    className="relative bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50 shadow-sm overflow-hidden"
                    whileHover={{ y: -2 }}
                    animate={isBlueWinning ? {
                        boxShadow: "0 10px 25px -5px rgba(56, 189, 248, 0.15)",
                        borderColor: "rgba(56, 189, 248, 0.25)"
                    } : {}}
                >
                    {isBlueWinning && (
                        <motion.div
                            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-400"
                            layoutId="winner-indicator"
                        />
                    )}
                    <div className="text-xs font-semibold text-slate-500 mb-1 tracking-wide uppercase">Team Blue</div>
                    <div className="text-4xl font-black bg-gradient-to-br from-sky-500 to-blue-500 bg-clip-text text-transparent">
                        {formatNumber(gameState.blueScore)}
                    </div>
                </motion.div>

                {/* Red Team */}
                <motion.div
                    className="relative bg-white/90 backdrop-blur rounded-2xl p-4 border border-slate-200/50 shadow-sm overflow-hidden"
                    whileHover={{ y: -2 }}
                    animate={isRedWinning ? {
                        boxShadow: "0 10px 25px -5px rgba(251, 113, 133, 0.15)",
                        borderColor: "rgba(251, 113, 133, 0.25)"
                    } : {}}
                >
                    {isRedWinning && (
                        <motion.div
                            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-pink-400"
                            layoutId="winner-indicator"
                        />
                    )}
                    <div className="text-xs font-semibold text-slate-500 mb-1 tracking-wide uppercase">Team Red</div>
                    <div className="text-4xl font-black bg-gradient-to-br from-rose-500 to-pink-500 bg-clip-text text-transparent">
                        {formatNumber(gameState.redScore)}
                    </div>
                </motion.div>
            </div>

            {/* Progress Bar */}
            <div className="relative bg-white/90 backdrop-blur rounded-2xl p-3 border border-slate-200/50 shadow-sm">
                <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-500">
                    <span>{bluePercentage.toFixed(0)}%</span>
                    <span className="text-slate-400">VS</span>
                    <span>{redPercentage.toFixed(0)}%</span>
                </div>
                <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <div className="flex h-full">
                        <motion.div
                            className="bg-gradient-to-r from-sky-400 to-blue-400"
                            initial={{ width: '50%' }}
                            animate={{ width: `${bluePercentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                        <motion.div
                            className="bg-gradient-to-r from-rose-400 to-pink-400"
                            initial={{ width: '50%' }}
                            animate={{ width: `${redPercentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
