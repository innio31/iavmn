// scripts/seed-test-member.mjs
// One-off: create a test member for local API testing. Safe to re-run.
import 'dotenv/config';
import { query } from '../src/db.js';
import { createMemberFromApplication, setMemberPassword, findMemberByEmail } from '../src/models/memberModel.js';
import { listTiers } from '../src/models/tierModel.js';

const EMAIL = 'test.member@iavmn.local';
const PASSWORD = 'TestPass123';

const run = async () => {
  console.log('[seed] start');

  const existing = await findMemberByEmail(EMAIL);
  if (existing) {
    await setMemberPassword(existing.id, PASSWORD);
    console.log('Member already exists — password reset to:', PASSWORD);
    console.log('  member_number:', existing.member_number, '| id:', existing.id);
    return;
  }

  const tiers = await listTiers(false);
  const tier = tiers[0];
  if (!tier) {
    console.error('[seed] No tiers in DB. Create at least one membership tier first (web admin → Tiers).');
    process.exit(1);
  }
  console.log('[seed] using tier:', tier.name, '| id:', tier.id);

  // Insert a minimal fake "application" so createMemberFromApplication has a row to reference.
  const ref = `TEST-${Date.now()}`;
  const ins = await query(
    `INSERT INTO membership_applications
       (reference, tier_id, full_name, email, phone, address, employer, qualifications, years_experience, status, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'paid')`,
    [ref, tier.id, 'Test Member', EMAIL, '+2348000000000', 'Lagos, Nigeria', 'Test Co', 'BSc, MSc', 5]
  );

  const appRow = {
    id: ins.insertId,
    tier_id: tier.id,
    full_name: 'Test Member',
    email: EMAIL,
    phone: '+2348000000000',
    address: 'Lagos, Nigeria',
    employer: 'Test Co',
    qualifications: 'BSc, MSc',
    years_experience: 5,
    photo_path: null,
  };

  const memberId = await createMemberFromApplication(appRow, 12);
  await setMemberPassword(memberId, PASSWORD);

  const member = await findMemberByEmail(EMAIL);
  console.log('✓ Test member created');
  console.log('  id:            ', member.id);
  console.log('  member_number: ', member.member_number);
  console.log('  email:         ', EMAIL);
  console.log('  password:      ', PASSWORD);
  console.log('  tier:          ', member.tier_name);
  console.log('  expires_at:    ', member.expires_at);
};

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  });