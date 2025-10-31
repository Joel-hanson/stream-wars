'use client';

import { User } from '@/lib/types';

interface UserInfoProps {
    user: User;
}

export function UserInfo({ user }: UserInfoProps) {
    const teamColor = user.team === 'blue' ? 'text-blue-600' : 'text-red-600';
    const teamBg = user.team === 'blue' ? 'bg-blue-100' : 'bg-red-100';

    return (
        <div className="bg-white rounded-lg p-5 border border-slate-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${teamBg} flex items-center justify-center`}>
                        <span className={`font-bold ${teamColor}`}>
                            {user.team === 'blue' ? 'B' : 'R'}
                        </span>
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{user.username}</div>
                        <div className={`text-sm font-medium ${teamColor}`}>
                            Team {user.team.charAt(0).toUpperCase() + user.team.slice(1)}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-3xl font-bold text-slate-900">
                        {user.tapCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600">Taps</div>
                </div>
            </div>
        </div>
    );
}
