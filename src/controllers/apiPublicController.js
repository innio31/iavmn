// src/controllers/apiPublicController.js
// Public API endpoints — no authentication required.
// - /verify/:memberNumber mirrors verifyController.showVerifyPage logic
// - /tiers returns active membership tiers (reference only in v1)

import { findMemberByNumber } from '../models/memberModel.js';
import { listTiers } from '../models/tierModel.js';
import { getAllSettings } from '../models/settingsModel.js';

// ─── GET /api/v1/public/verify/:memberNumber ────────────

export const verifyMember = async (req, res, next) => {
  try {
    // Match verifyController: accept URL-encoded member numbers, trim.
    let memberNumber = String(req.params.memberNumber || '').trim();
    try { memberNumber = decodeURIComponent(memberNumber); } catch { /* keep raw */ }

    if (!memberNumber) {
      return res.status(400).json({ error: 'Member number is required.', code: 'MISSING_NUMBER', valid: false });
    }

    const member = await findMemberByNumber(memberNumber);
    if (!member) {
      return res.json({ valid: false, reason: 'not_found' });
    }

    const isActive = member.status === 'active';
    if (!isActive) {
      // Never leak personal info for inactive members; just report status.
      return res.json({
        valid: false,
        reason: 'inactive',
        member: {
          full_name: member.full_name,
          member_number: member.member_number,
          tier_name: member.tier_name || null,
          status: member.status,
        },
      });
    }

    // Same privacy envelope as the web verify page: only the fields shown publicly.
    return res.json({
      valid: true,
      member: {
        full_name: member.full_name,
        member_number: member.member_number,
        tier_name: member.tier_name || null,
        status: member.status,
        joined_at: member.joined_at,
        expires_at: member.expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/public/tiers ───────────────────────────

export const publicTiers = async (req, res, next) => {
  try {
    const tiers = await listTiers(true); // active only
    return res.json({
      tiers: tiers.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        short_description: t.short_description,
        description: t.description,
        icon: t.icon,
        fee_amount: Number(t.fee_amount || 0),
        registration_fee: Number(t.registration_fee || 0),
        currency: t.currency || 'NGN',
        sort_order: t.sort_order,
      })),
    });
  } catch (err) {
    next(err);
  }
};