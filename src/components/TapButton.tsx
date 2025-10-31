'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface TapButtonProps {
    team: 'blue' | 'red';
    onTap: () => void;
    isConnected: boolean;
}

export function TapButton({ team, onTap, isConnected }: TapButtonProps) {
    const [isTapping, setIsTapping] = useState(false);

    const handleTap = () => {
        if (!isConnected) return;

        setIsTapping(true);
        onTap();

        setTimeout(() => setIsTapping(false), 100);
    };

    const buttonColor = team === 'blue' ? 'bg-blue-600' : 'bg-red-600';
    const hoverColor = team === 'blue' ? 'hover:bg-blue-700' : 'hover:bg-red-700';

    return (
        <motion.button
            className={`
                w-48 h-48 sm:w-56 sm:h-56
                ${buttonColor} ${hoverColor}
                rounded-full
                flex items-center justify-center
                text-white font-semibold text-xl
                transition-colors
                ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                select-none
                shadow-lg
            `}
            onClick={handleTap}
            disabled={!isConnected}
            whileTap={isConnected ? { scale: 0.95 } : {}}
            animate={{
                scale: isTapping ? 0.95 : 1,
            }}
            transition={{ duration: 0.1 }}
        >
            {isConnected ? 'TAP' : 'Connecting...'}
        </motion.button>
    );
}
