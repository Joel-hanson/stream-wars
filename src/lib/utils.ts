import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from 'uuid';
import type { Team } from './types';

/**
 * Utility for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID using uuid v4
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a random username
 */
export function generateUsername(): string {
  const adjectives = ['Swift', 'Bold', 'Quick', 'Sharp', 'Bright', 'Fast', 'Strong', 'Smart', 'Cool', 'Epic'];
  const nouns = ['Tapper', 'Warrior', 'Champion', 'Hero', 'Legend', 'Master', 'Pro', 'Star', 'Ace', 'Boss'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${adjective}${noun}${number}`;
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Get team primary color class
 */
export function getTeamColor(team: Team): string {
  return team === 'blue' ? 'bg-blue-500' : 'bg-red-500';
}

/**
 * Get team light color class
 */
export function getTeamLightColor(team: Team): string {
  return team === 'blue' ? 'bg-blue-400' : 'bg-red-400';
}

/**
 * Get team gradient classes
 */
export function getTeamGradient(team: Team): string {
  return team === 'blue' 
    ? 'from-sky-400 to-blue-400' 
    : 'from-rose-400 to-pink-400';
}

/**
 * Get team accent color name
 */
export function getTeamAccent(team: Team): string {
  return team === 'blue' ? 'sky' : 'rose';
}

/**
 * Assign a team randomly (50/50 distribution)
 * For balanced team assignment, use the server-side balancing logic
 */
export function assignTeam(): Team {
  return Math.random() < 0.5 ? 'blue' : 'red';
}