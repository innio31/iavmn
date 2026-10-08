// src/controllers/verifyController.js
// Public member verification. Anyone with a member number (or a QR scan)
// can confirm whether a member is legitimate and currently active.
//
// Privacy: we NEVER expose email, phone, address, or other personal data.
// Only: name, tier, member number, status, joined date, expiry date.

import { findMemberByNumber } from '../models/memberModel.js';

export const showVerifyPage = async (req, res) => {
  // Accept the member number from either:
  //   - Query string:  /verify?memberNumber=IAVMN/MEM/2026/0001
  //   - Path param:    /verify/IAVMN%2FMEM%2F2026%2F0001  (URL-encoded)
  const raw =
    (req.query && req.query.memberNumber) ||
    (req.params && req.params.memberNumber) ||
    '';

  // Decode in case a URL-encoded value slipped through
  let memberNumber = String(raw).trim();
  try { memberNumber = decodeURIComponent(memberNumber); } catch (e) { /* keep raw */ }

  if (!memberNumber) {
    return res.render('verify', {
      title: 'Verify Membership',
      member: null,
      foundMember: null,
      memberNumber: '',
      searched: false,
    });
  }

  const member = await findMemberByNumber(memberNumber);
  const isActive = member && member.status === 'active';

  res.render('verify', {
    title: member ? 'Verify Membership' : 'Member Not Found',
    member: isActive ? member : null,
    foundMember: member || null,
    memberNumber,
    searched: true,
  });
};