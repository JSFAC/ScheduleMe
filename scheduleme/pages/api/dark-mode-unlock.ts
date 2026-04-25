import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getUnknownFields, rateLimit, requireAuth, setSecurityHeaders } from '../../lib/apiSecurity';

const DARK_MODE_REQUIRED_SHARES = 3;

type RewardState = {
  share_count: number;
  unlocked: boolean;
  unlocked_at: string | null;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function coerceObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function parseRewardState(notifications: unknown): RewardState {
  const root = coerceObject(notifications);
  const rewards = coerceObject(root.rewards);

  const rawCount = Number(rewards.dark_mode_share_count ?? rewards.darkModeShareCount ?? 0);
  const safeCount = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;

  const rawUnlocked = rewards.dark_mode_unlocked ?? rewards.darkModeUnlocked;
  const explicitUnlocked = rawUnlocked === true;
  const unlocked = explicitUnlocked || safeCount >= DARK_MODE_REQUIRED_SHARES;

  const rawUnlockedAt = rewards.dark_mode_unlocked_at ?? rewards.darkModeUnlockedAt;
  const unlocked_at = typeof rawUnlockedAt === 'string' && rawUnlockedAt.trim() ? rawUnlockedAt : null;

  return {
    share_count: safeCount,
    unlocked,
    unlocked_at,
  };
}

function writeRewardState(notifications: unknown, nextState: RewardState) {
  const root = coerceObject(notifications);
  const rewards = coerceObject(root.rewards);

  const mergedRewards = {
    ...rewards,
    dark_mode_share_count: nextState.share_count,
    dark_mode_unlocked: nextState.unlocked,
    dark_mode_unlocked_at: nextState.unlocked ? (nextState.unlocked_at || new Date().toISOString()) : null,
  };

  return {
    ...root,
    rewards: mergedRewards,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 90, windowMs: 60_000, keyPrefix: 'dark-mode-unlock' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, notifications')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: profileError.message || 'Failed to load profile' });
  }

  const currentNotifications = profile?.notifications ?? null;
  const currentState = parseRewardState(currentNotifications);

  if (req.method === 'GET') {
    return res.status(200).json({
      unlocked: currentState.unlocked,
      share_count: currentState.share_count,
      required_shares: DARK_MODE_REQUIRED_SHARES,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allowedFields = ['action'];
  const unknownFields = getUnknownFields(req.body, allowedFields);
  if (unknownFields.length > 0) {
    return res.status(400).json({ error: `Unexpected fields: ${unknownFields.join(', ')}` });
  }

  const action = String(req.body?.action || '').trim();
  if (action !== 'record_share') {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const nextShareCount = currentState.share_count + 1;
  const nextUnlocked = nextShareCount >= DARK_MODE_REQUIRED_SHARES;

  const nextState: RewardState = {
    share_count: nextShareCount,
    unlocked: nextUnlocked,
    unlocked_at: nextUnlocked ? (currentState.unlocked_at || new Date().toISOString()) : null,
  };

  const mergedNotifications = writeRewardState(currentNotifications, nextState);

  const { error: updateError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email || null,
        notifications: mergedNotifications,
      },
      { onConflict: 'id' }
    );

  if (updateError) {
    return res.status(500).json({ error: updateError.message || 'Failed to save unlock progress' });
  }

  return res.status(200).json({
    unlocked: nextState.unlocked,
    share_count: nextState.share_count,
    required_shares: DARK_MODE_REQUIRED_SHARES,
  });
}
