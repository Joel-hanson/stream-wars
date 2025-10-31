import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateUsername(): string {
  const adjectives = ['Swift', 'Bold', 'Quick', 'Sharp', 'Bright', 'Fast', 'Strong', 'Smart', 'Cool', 'Epic'];
  const nouns = ['Tapper', 'Warrior', 'Champion', 'Hero', 'Legend', 'Master', 'Pro', 'Star', 'Ace', 'Boss'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${adjective}${noun}${number}`;
}

export function assignTeam(): 'blue' | 'red' {
  return Math.random() < 0.5 ? 'blue' : 'red';
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function getTeamColor(team: 'blue' | 'red'): string {
  return team === 'blue' ? 'bg-blue-500' : 'bg-red-500';
}

export function getTeamLightColor(team: 'blue' | 'red'): string {
  return team === 'blue' ? 'bg-blue-400' : 'bg-red-400';
}