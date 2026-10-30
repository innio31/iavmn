// src/controllers/certificateController.js
// Generates the member certificate as a PDF (pdfkit) and the QR code image (qrcode).
// Design: green ribbon + gold seal (left), gold title, member name, grade, signatures,
// centre seal, QR (right) and a green footer bar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { findMemberById, findMemberByNumber } from '../models/memberModel.js';
import { getAllSettings } from '../models/settingsModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const ORG_NAME_LINES = [
  'INSTITUTE OF ASSETS',
  'AND VALUES',
  'MANAGEMENT OF NIGERIA',
];

const ORG_FULL_NAME = 'Institute of Assets and Values Management of Nigeria';
const ORG_TAGLINE = 'Building Professionals... Creating Value... Transforming Assets';

// ─── Custom Font ────────────────────────────────────────
// Place a TTF file at public/fonts/certificate-name.ttf.
// Recommended font: Cinzel Bold from Google Fonts.
// If missing, the controller falls back to Times-Bold.

const NAME_FONT_FILE = path.join(
  PUBLIC_DIR,
  'fonts',
  'certificate-name.ttf'
);

const NAME_FONT_KEY = 'CertificateNameFont';

// ─── Helpers ────────────────────────────────────────────

const fmtDateUS = (dt) => {
  if (!dt) return '—';

  const d = new Date(dt);

  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const resolvePublicFile = (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') return null;

  if (!publicPath.startsWith('/')) return null;

  const rel = publicPath.replace(/^\//, '');
  const abs = path.join(PUBLIC_DIR, rel);

  if (!fs.existsSync(abs)) return null;

  return abs;
};

const getBaseUrl = (settings) => {
  const base =
    (settings && settings.app_url) ||
    process.env.APP_URL ||
    'http://localhost:3000';

  return base.replace(/\/$/, '');
};

const buildVerificationUrl = (settings, memberNumber) =>
  `${getBaseUrl(settings)}/verify/${encodeURIComponent(memberNumber)}`;

const displayVerifyHost = (settings) => {
  try {
    return `${new URL(getBaseUrl(settings)).host}/verify`;
  } catch (e) {
    return 'www.iavmn.org/verify';
  }
};

const drawSingleLineText = (
  doc,
  text,
  x,
  y,
  maxWidth,
  baseSize,
  options = {}
) => {
  const font = options.font || 'Helvetica-Bold';
  const color = options.color || '#1B4230';
  const align = options.align || 'center';
  const characterSpacing = options.characterSpacing || 0;

  let size = baseSize;

  doc.font(font).fontSize(size);

  while (
    size > 5 &&
    doc.widthOfString(text, { characterSpacing }) > maxWidth
  ) {
    size -= 0.5;
    doc.fontSize(size);
  }

  doc.fillColor(color).text(text, x, y, {
    width: maxWidth,
    align,
    lineBreak: false,
    ellipsis: true,
    characterSpacing,
  });

  return size;
};

const drawScallop = (doc, cx, cy, r, teeth, fill) => {
  const pts = [];
  const n = teeth * 2;

  for (let i = 0; i < n; i += 1) {
    const ang = (i / n) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * 0.94;

    pts.push([
      cx + rad * Math.cos(ang),
      cy + rad * Math.sin(ang),
    ]);
  }

  doc.save();
  doc.polygon(...pts).fill(fill);
  doc.restore();
};

const drawStar = (doc, cx, cy, r, fill) => {
  const pts = [];

  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;

    pts.push([
      cx + rad * Math.cos(ang),
      cy + rad * Math.sin(ang),
    ]);
  }

  doc.save();
  doc.polygon(...pts).fill(fill);
  doc.restore();
};

const drawEmblem = (doc, cx, cy, r, globeColor, arrowColor) => {
  doc.save();

  doc.lineWidth(Math.max(0.5, r * 0.08)).strokeColor(globeColor);
  doc.circle(cx, cy, r).stroke();
  doc.ellipse(cx, cy, r * 0.42, r).stroke();

  [-0.5, 0, 0.5].forEach((k) => {
    const d = r * k;
    const hw = Math.sqrt(r * r - d * d);

    doc
      .moveTo(cx - hw, cy + d)
      .lineTo(cx + hw, cy + d)
      .stroke();
  });

  doc
    .moveTo(cx, cy - r)
    .lineTo(cx, cy + r)
    .stroke();

  const rel = [
    [-0.7, 0.85],
    [-0.3, 0.3],
    [0.0, 0.55],
    [0.62, -0.2],
  ];

  doc
    .lineWidth(r * 0.22)
    .strokeColor(arrowColor)
    .lineJoin('round')
    .lineCap('round');

  doc.moveTo(
    cx + rel[0][0] * r,
    cy + rel[0][1] * r
  );

  for (let i = 1; i < rel.length; i += 1) {
    doc.lineTo(
      cx + rel[i][0] * r,
      cy + rel[i][1] * r
    );
  }

  doc.stroke();

  const ex = cx + rel[3][0] * r;
  const ey = cy + rel[3][1] * r;

  doc.polygon(
    [ex + 0.42 * r, ey - 0.42 * r],
    [ex - 0.12 * r, ey - 0.34 * r],
    [ex + 0.34 * r, ey + 0.12 * r]
  ).fill(arrowColor);

  doc.restore();
};

const drawArcText = (
  doc,
  text,
  cx,
  cy,
  radius,
  position,
  opts = {}
) => {
  const size = opts.size || 5;
  const font = opts.font || 'Helvetica-Bold';
  const color = opts.color || '#FFFFFF';
  const spacing = opts.spacing || 0.5;

  doc.save();
  doc.font(font).fontSize(size).fillColor(color);

  const chars = text.split('');
  const widths = chars.map(
    (c) => doc.widthOfString(c) + spacing
  );

  const totalAngle =
    widths.reduce((a, b) => a + b, 0) / radius;

  const centerAngle = position === 'top' ? 0 : Math.PI;

  let cursor = 0;

  chars.forEach((ch, i) => {
    const mid = (cursor + widths[i] / 2) / radius;

    const theta =
      position === 'top'
        ? centerAngle - totalAngle / 2 + mid
        : centerAngle + totalAngle / 2 - mid;

    const x = cx + radius * Math.sin(theta);
    const y = cy - radius * Math.cos(theta);

    const deg =
      position === 'top'
        ? (theta * 180) / Math.PI
        : (theta * 180) / Math.PI + 180;

    doc.save();
    doc.translate(x, y);
    doc.rotate(deg);

    doc.text(
      ch,
      -widths[i] / 2 + spacing / 2,
      -size * 0.8,
      { lineBreak: false }
    );

    doc.restore();

    cursor += widths[i];
  });

  doc.restore();
};

const drawFlourish = (doc, cx, cy, dir, color) => {
  doc.save();

  doc.lineWidth(0.8).strokeColor(color);

  doc
    .moveTo(cx, cy)
    .bezierCurveTo(
      cx + dir * 7,
      cy - 5,
      cx + dir * 13,
      cy + 5,
      cx + dir * 22,
      cy
    )
    .stroke();

  doc
    .moveTo(cx + dir * 22, cy)
    .lineTo(cx + dir * 34, cy)
    .stroke();

  doc.circle(cx + dir * 36, cy, 1.4).fill(color);

  doc.restore();
};

// ─── QR code image ──────────────────────────────────────

export const serveQrCode = async (req, res) => {
  try {
    const member = await findMemberById(req.member.id);

    if (!member) return res.status(404).end();

    const settings = await getAllSettings();

    const url = buildVerificationUrl(
      settings,
      member.member_number
    );

    const png = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 1,
      width: 400,
      color: {
        dark: '#25573FFF',
        light: '#FFFFFFFF',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(png);
  } catch (err) {
    console.error('[qr] failed:', err.message);
    res.status(500).end();
  }
};

// ─── Certificate PDF: member download ───────────────────

export const downloadCertificatePdf = async (req, res) => {
  try {
    const member = await findMemberById(req.member.id);

    if (!member) return res.status(404).end();

    if (member.status !== 'active') {
      req.flash(
        'error',
        'Your membership must be active to download a certificate.'
      );

      return res.redirect('/member/certificate');
    }

    const settings = await getAllSettings();

    await streamCertificate(
      res,
      member,
      settings,
      { watermark: false }
    );
  } catch (err) {
    console.error('[certificate pdf] failed:', err.message);

    if (!res.headersSent) {
      req.flash(
        'error',
        'Could not generate your certificate. Please try again.'
      );

      res.redirect('/member/certificate');
    }
  }
};

// ─── Certificate PDF: public download (by member number) ─

export const downloadPublicCertificatePdf = async (
  req,
  res,
  next
) => {
  try {
    const member = await findMemberByNumber(
      req.params.memberNumber
    );

    if (!member) return next();

    if (member.status !== 'active') return next();

    const settings = await getAllSettings();

    await streamCertificate(
      res,
      member,
      settings,
      { watermark: false }
    );
  } catch (err) {
    console.error('[public certificate] failed:', err.message);
    next(err);
  }
};

// ─── Certificate PDF: admin preview (with watermark) ────

export const previewCertificatePdf = async (req, res) => {
  try {
    const member = await findMemberById(req.params.id);

    if (!member) {
      req.flash('error', 'Member not found.');
      return res.redirect('/admin/members');
    }

    const settings = await getAllSettings();

    await streamCertificate(
      res,
      member,
      settings,
      { watermark: true }
    );
  } catch (err) {
    console.error('[preview certificate] failed:', err.message);

    if (!res.headersSent) {
      req.flash(
        'error',
        'Could not generate the certificate preview.'
      );

      res.redirect('/admin/members');
    }
  }
};

// ─── Core PDF rendering ─────────────────────────────────

const streamCertificate = async (
  res,
  member,
  settings,
  opts = {}
) => {
  const showWatermark = Boolean(opts.watermark);

  const siteName =
    (settings && settings.site_name) || ORG_FULL_NAME;

  const siteShort =
    (settings && settings.site_short_name) || 'IAVMN';

  const rcNumber =
    (settings && settings.cert_rc_number) || '8855702';

  const logoPath = resolvePublicFile(
    settings && settings.site_logo_path
  );

  const registrarSigPath = resolvePublicFile(
    settings && settings.cert_signature_registrar_path
  );

  const presidentSigPath = resolvePublicFile(
    settings && settings.cert_signature_president_path
  );

  const registrarName =
    (settings && settings.cert_registrar_name) || '';

  const registrarTitle =
    (settings && settings.cert_registrar_title) ||
    'Registrar / Chief Executive';

  const presidentName =
    (settings && settings.cert_president_name) || '';

  const presidentTitle =
    (settings && settings.cert_president_title) ||
    'President / Chairman of Council';

  const verificationUrl = buildVerificationUrl(
    settings,
    member.member_number
  );

  const qrPng = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 1,
    width: 600,
    color: {
      dark: '#25573FFF',
      light: '#FFFFFFFF',
    },
  });

  const baseFilename = showWatermark
    ? `IAVMN-Certificate-PREVIEW-${member.member_number.replace(/[\/\\]/g, '-')}.pdf`
    : `IAVMN-Certificate-${member.member_number.replace(/[\/\\]/g, '-')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');

  res.setHeader(
    'Content-Disposition',
    `${showWatermark ? 'inline' : 'attachment'}; filename="${baseFilename}"`
  );

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    info: {
      Title: showWatermark
        ? `IAVMN Certificate PREVIEW — ${member.full_name}`
        : `IAVMN Certificate — ${member.full_name}`,
      Author: siteName,
      Subject: showWatermark
        ? 'Certificate Preview (NOT VALID)'
        : 'Certificate of Membership',
      Keywords: showWatermark
        ? `preview, not valid, ${member.member_number}`
        : `certificate, membership, ${siteShort}, ${member.member_number}`,
      Creator: siteShort,
    },
  });

  // ─── Register custom font BEFORE piping ───────────────

  let nameFontKey = 'Times-Bold';

  try {
    if (fs.existsSync(NAME_FONT_FILE)) {
      doc.registerFont(NAME_FONT_KEY, NAME_FONT_FILE);
      nameFontKey = NAME_FONT_KEY;

      console.log('[certificate] Cinzel font loaded successfully.');
    } else {
      console.warn(
        '[certificate] Custom font not found. Using Times-Bold.'
      );
    }
  } catch (fontErr) {
    console.warn(
      '[certificate] Could not load custom font:',
      fontErr.message
    );
  }

  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;
  const S = W / 1280;

  const P = (v) => v * S;
  const cx = W / 2;

  const frameGreen = '#0E3B28';
  const ribbonGreen = '#1E5A3E';
  const darkGreen = '#1B4230';
  const gold = '#C9A233';
  const goldLight = '#E2C466';
  const cream = '#FBF9F0';
  const grey = '#495057';

  const border = 9;
  const footerTop = P(805);

  // ─── Background & frame ──────────────────────────────

  doc.rect(0, 0, W, H).fill(frameGreen);
  doc.rect(
    border,
    border,
    W - border * 2,
    H - border * 2
  ).fill(cream);

  // Left dark band
  const ribbonL = P(70);
  const ribbonR = P(235);
  const ribbonMid = (ribbonL + ribbonR) / 2;

  doc.rect(
    border,
    border,
    ribbonL - border,
    H - border * 2
  ).fill(frameGreen);

  // Footer bar
  doc.rect(0, footerTop, W, H - footerTop).fill(frameGreen);

  doc
    .lineWidth(1.2)
    .strokeColor(gold)
    .moveTo(P(240), footerTop)
    .lineTo(W - border, footerTop)
    .stroke();

  // ─── Left ribbon with V-notch ─────────────────────────

  const ribbonBottom = P(615);
  const notchY = P(648);

  doc.save();

  doc.polygon(
    [ribbonL, border],
    [ribbonR, border],
    [ribbonR, ribbonBottom],
    [ribbonMid, notchY],
    [ribbonL, ribbonBottom]
  ).fill(ribbonGreen);

  doc
    .lineWidth(1.4)
    .strokeColor(gold)
    .moveTo(ribbonL, border)
    .lineTo(ribbonL, ribbonBottom)
    .lineTo(ribbonMid, notchY)
    .lineTo(ribbonR, ribbonBottom)
    .lineTo(ribbonR, border)
    .stroke();

  doc.restore();

  // Gold frame lines
  doc
    .lineWidth(1.6)
    .strokeColor(gold)
    .rect(5, 5, W - 10, H - 10)
    .stroke();

  doc
    .lineWidth(0.6)
    .strokeColor(gold)
    .rect(
      border,
      border,
      W - border * 2,
      H - border * 2
    )
    .stroke();

  // ─── Ribbon seal ─────────────────────────────────────

  const sealCx = ribbonMid;
  const sealCy = P(290);

  drawScallop(doc, sealCx, sealCy, P(72), 28, gold);

  doc.circle(sealCx, sealCy, P(62)).fill(goldLight);
  doc.circle(sealCx, sealCy, P(58)).fill(frameGreen);

  doc
    .lineWidth(0.8)
    .strokeColor(gold)
    .circle(sealCx, sealCy, P(54))
    .stroke();

  drawEmblem(
    doc,
    sealCx,
    sealCy - P(14),
    P(26),
    '#FFFFFF',
    gold
  );

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#FFFFFF')
    .text(siteShort, sealCx - 40, sealCy + P(24), {
      width: 80,
      align: 'center',
      lineBreak: false,
    });

  // Values on the ribbon
  doc.font('Helvetica').fontSize(6.2).fillColor('#FFFFFF');

  [
    'INTEGRITY',
    'PROFESSIONALISM',
    'EXCELLENCE',
    'ACCOUNTABILITY',
  ].forEach((v, i) => {
    doc.text(v, ribbonL, P(462) + i * P(22), {
      width: ribbonR - ribbonL,
      align: 'center',
      lineBreak: false,
      characterSpacing: 0.3,
    });
  });

  drawStar(doc, ribbonMid, P(560), 4.6, gold);

  // ─── Header: logo + organisation name ────────────────

  const logoBoxX = P(292);
  const logoBoxY = P(52);
  const logoBox = P(118);

  if (logoPath) {
    try {
      doc.image(logoPath, logoBoxX, logoBoxY, {
        fit: [logoBox, logoBox],
        align: 'center',
        valign: 'center',
      });
    } catch (e) {
      drawEmblem(
        doc,
        logoBoxX + logoBox / 2,
        logoBoxY + logoBox / 2,
        logoBox * 0.42,
        darkGreen,
        gold
      );
    }
  } else {
    drawEmblem(
      doc,
      logoBoxX + logoBox / 2,
      logoBoxY + logoBox / 2,
      logoBox * 0.42,
      darkGreen,
      gold
    );
  }

  const dividerX = P(437);

  doc
    .lineWidth(0.8)
    .strokeColor('#3A3A3A')
    .moveTo(dividerX, P(58))
    .lineTo(dividerX, P(150))
    .stroke();

  const orgTextX = P(452);
  const orgTextW = P(350);

  ORG_NAME_LINES.forEach((line, i) => {
    drawSingleLineText(
      doc,
      line,
      orgTextX,
      P(60) + i * 17.5,
      orgTextW,
      16.5,
      {
        font: 'Helvetica-Bold',
        color: '#14301F',
        align: 'left',
      }
    );
  });

  doc
    .font('Helvetica')
    .fontSize(6.4)
    .fillColor('#D9822B')
    .text(
      ORG_TAGLINE,
      orgTextX,
      P(60) + 3 * 17.5 + 2,
      {
        width: orgTextW,
        lineBreak: false,
      }
    );

  // ─── Top-right: membership number & RC ───────────────

  const infoCx = P(1050);
  const infoW = 150;

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#212529')
    .text(
      'Membership No.:',
      infoCx - infoW / 2,
      P(80),
      {
        width: infoW,
        align: 'center',
        lineBreak: false,
      }
    );

  drawSingleLineText(
    doc,
    member.member_number,
    infoCx - infoW / 2,
    P(96),
    infoW,
    10,
    {
      font: 'Helvetica-Bold',
      color: '#14301F',
    }
  );

  drawFlourish(doc, infoCx - 20, P(138), 1, gold);
  drawFlourish(doc, infoCx + 20, P(138), -1, gold);

  doc
    .font('Helvetica-Bold')
    .fontSize(6)
    .fillColor('#212529')
    .text(
      'Incorporated with Corporate',
      infoCx - infoW / 2,
      P(160),
      {
        width: infoW,
        align: 'center',
        lineBreak: false,
      }
    )
    .text(
      'Affairs Commission (CAC)',
      infoCx - infoW / 2,
      P(160) + 8,
      {
        width: infoW,
        align: 'center',
        lineBreak: false,
      }
    )
    .text(
      `RC: ${rcNumber}`,
      infoCx - infoW / 2,
      P(160) + 17,
      {
        width: infoW,
        align: 'center',
        lineBreak: false,
      }
    );

  // Gold corner ornament
  doc.save();

  doc.lineWidth(1).strokeColor(gold);

  doc
    .moveTo(W - 14, 16)
    .bezierCurveTo(W - 40, 16, W - 60, 22, W - 78, 12)
    .stroke();

  doc
    .moveTo(W - 14, 16)
    .bezierCurveTo(W - 16, 40, W - 22, 60, W - 12, 78)
    .stroke();

  doc
    .moveTo(W - 20, 22)
    .bezierCurveTo(W - 42, 24, W - 52, 34, W - 56, 48)
    .stroke();

  doc
    .moveTo(W - 20, 22)
    .bezierCurveTo(W - 24, 44, W - 34, 52, W - 44, 56)
    .stroke();

  doc.circle(W - 24, 26, 2.2).fill(gold);

  doc.restore();

  // Faint watermark emblem
  doc.save();
  doc.opacity(0.09);

  drawEmblem(
    doc,
    P(1115),
    P(355),
    P(95),
    gold,
    gold
  );

  doc.restore();

  // ─── Certificate title ──────────────────────────────

  drawSingleLineText(
    doc,
    'CERTIFICATE',
    0,
    P(196),
    W,
    46,
    {
      font: 'Times-Bold',
      color: gold,
      characterSpacing: 6,
    }
  );

  doc.font('Times-Bold').fontSize(15);

  const subText = 'OF MEMBERSHIP';
  const subSpacing = 3.5;

  const subW = doc.widthOfString(subText, {
    characterSpacing: subSpacing,
  });

  const subY = P(286);

  doc.fillColor('#2B2B2B').text(
    subText,
    cx - subW / 2,
    subY,
    {
      lineBreak: false,
      characterSpacing: subSpacing,
    }
  );

  const lineMidY = subY + 8.5;

  doc
    .lineWidth(1)
    .strokeColor(gold)
    .moveTo(cx - subW / 2 - 14 - 62, lineMidY)
    .lineTo(cx - subW / 2 - 14, lineMidY)
    .stroke();

  doc
    .moveTo(cx + subW / 2 + 14, lineMidY)
    .lineTo(cx + subW / 2 + 14 + 62, lineMidY)
    .stroke();

  // ─── "THIS IS TO CERTIFY THAT" pill ──────────────────

  const pillW = P(300);
  const pillH = 18;
  const pillX = cx - pillW / 2;
  const pillY = P(325);

  doc.roundedRect(pillX, pillY, pillW, pillH, 9).fill(frameGreen);

  doc
    .lineWidth(0.8)
    .strokeColor(gold)
    .roundedRect(pillX, pillY, pillW, pillH, 9)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#FFFFFF')
    .text(
      'THIS IS TO CERTIFY THAT',
      pillX,
      pillY + 5,
      {
        width: pillW,
        align: 'center',
        lineBreak: false,
        characterSpacing: 0.6,
      }
    );

  // ─── Member name (CUSTOM FONT) ───────────────────────

  drawSingleLineText(
    doc,
    String(member.full_name || '').toUpperCase(),
    cx - 255,
    P(374),
    510,
    26,
    {
      font: nameFontKey,
      color: '#14301F',
      characterSpacing: 0.4,
    }
  );

  // Gold rule with diamond
  const ruleY = P(432);
  const ruleHalf = 232;

  doc
    .lineWidth(1)
    .strokeColor(gold)
    .moveTo(cx - ruleHalf, ruleY)
    .lineTo(cx - 7, ruleY)
    .moveTo(cx + 7, ruleY)
    .lineTo(cx + ruleHalf, ruleY)
    .stroke();

  doc.polygon(
    [cx, ruleY - 3.5],
    [cx + 3.5, ruleY],
    [cx, ruleY + 3.5],
    [cx - 3.5, ruleY]
  ).fill(gold);

  // ─── Body text ───────────────────────────────────────

  const bodyLines = [
    'having satisfied the rigorous requirements for membership and demonstrated',
    'a distinguished record of professional excellence, leadership, and commitment',
    'to the advancement of assets and values management, is hereby admitted and qualified as a',
  ];

  doc.font('Times-Roman').fontSize(10.5).fillColor('#212529');

  bodyLines.forEach((line, i) => {
    doc.text(
      line,
      cx - 240,
      P(452) + i * 15.5,
      {
        width: 480,
        align: 'center',
        lineBreak: false,
      }
    );
  });

  // ─── Grade (tier) ────────────────────────────────────

  const tierText = (member.tier_name || 'Member').toUpperCase();
  const tierY = P(530);

  const tierSize = drawSingleLineText(
    doc,
    tierText,
    cx - 190,
    tierY,
    380,
    30,
    {
      font: nameFontKey,
      color: darkGreen,
      characterSpacing: 1.5,
    }
  );

  doc.font(nameFontKey).fontSize(tierSize);

  const tierW = doc.widthOfString(tierText, {
    characterSpacing: 1.5,
  });

  drawFlourish(
    doc,
    cx - tierW / 2 - 12,
    tierY + tierSize * 0.55,
    -1,
    gold
  );

  drawFlourish(
    doc,
    cx + tierW / 2 + 12,
    tierY + tierSize * 0.55,
    1,
    gold
  );

  doc
    .font('Times-Roman')
    .fontSize(9.5)
    .fillColor('#212529')
    .text(
      `of the ${ORG_FULL_NAME} (${siteShort})`,
      cx - 240,
      tierY + 36,
      {
        width: 480,
        align: 'center',
        lineBreak: false,
      }
    )
    .text(
      'and is entitled to all rights, privileges and honours appertaining to this prestigious category.',
      cx - 260,
      tierY + 36 + 14,
      {
        width: 520,
        align: 'center',
        lineBreak: false,
      }
    );

  // ─── Date of induction ──────────────────────────────

  const dateParts = [
    `DATE OF INDUCTION: ${fmtDateUS(member.joined_at)}`,
  ];

  if (member.expires_at) {
    dateParts.push(
      `VALID UNTIL: ${fmtDateUS(member.expires_at)}`
    );
  }

  drawSingleLineText(
    doc,
    dateParts.join('        |        '),
    cx - 240,
    P(641),
    480,
    10,
    {
      font: 'Helvetica-Bold',
      color: '#14301F',
      characterSpacing: 0.2,
    }
  );

  // ─── Signatures ──────────────────────────────────────

  const sigWidth = P(245);
  const sigImgH = 36;
  const sigLineY = P(742);

  const drawSignatureBlock = (
    x,
    sigPath,
    name,
    title
  ) => {
    if (sigPath) {
      try {
        doc.image(
          sigPath,
          x,
          sigLineY - sigImgH - 3,
          {
            fit: [sigWidth, sigImgH],
            align: 'center',
            valign: 'bottom',
          }
        );
      } catch (e) {
        // Skip broken image
      }
    }

    doc
      .lineWidth(0.8)
      .strokeColor('#555555')
      .moveTo(x, sigLineY)
      .lineTo(x + sigWidth, sigLineY)
      .stroke();

    if (name) {
      drawSingleLineText(
        doc,
        name,
        x - 12,
        sigLineY + 5,
        sigWidth + 24,
        8.5,
        {
          font: 'Helvetica-Bold',
          color: darkGreen,
        }
      );
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(6.2)
      .fillColor(grey)
      .text(
        title.toUpperCase(),
        x - 12,
        sigLineY + (name ? 17 : 6),
        {
          width: sigWidth + 24,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
          characterSpacing: 0.2,
        }
      );
  };

  drawSignatureBlock(
    P(290),
    presidentSigPath,
    presidentName,
    presidentTitle
  );

  drawSignatureBlock(
    P(765),
    registrarSigPath,
    registrarName,
    registrarTitle
  );

  // ─── QR code ─────────────────────────────────────────

  const qrBox = 74;
  const qrCx = P(1145);
  const qrBoxX = qrCx - qrBox / 2;
  const qrBoxY = P(643);

  doc
    .lineWidth(1.2)
    .strokeColor(gold)
    .roundedRect(qrBoxX, qrBoxY, qrBox, qrBox, 6)
    .stroke();

  doc.image(
    qrPng,
    qrBoxX + 6,
    qrBoxY + 6,
    {
      fit: [qrBox - 12, qrBox - 12],
    }
  );

  doc
    .font('Helvetica-Bold')
    .fontSize(6.4)
    .fillColor('#14301F')
    .text(
      'VERIFY MEMBERSHIP',
      qrBoxX - 20,
      qrBoxY + qrBox + 6,
      {
        width: qrBox + 40,
        align: 'center',
        lineBreak: false,
      }
    );

  // ─── Bottom-left laurel badge ────────────────────────

  const lbx = P(155);
  const lby = P(742);
  const lbr = 54;

  doc.circle(lbx, lby, lbr).fill('#FFFFFF');

  doc
    .lineWidth(1)
    .strokeColor(gold)
    .circle(lbx, lby, lbr)
    .stroke();

  [-1, 1].forEach((side) => {
    for (let i = 0; i < 9; i += 1) {
      const phi = side * (20 + i * 15.5);
      const rad = (phi * Math.PI) / 180;

      const lx = lbx + 40 * Math.sin(rad);
      const ly = lby - 40 * Math.cos(rad);

      doc.save();
      doc.translate(lx, ly);
      doc.rotate(phi - side * 35);
      doc.ellipse(0, 0, 5.6, 2.3).fill(gold);
      doc.restore();
    }
  });

  doc.font('Helvetica-Bold').fontSize(4.6).fillColor('#14301F');

  [
    'DEDICATED TO',
    'EXCELLENCE IN',
    'ASSETS AND',
    'VALUES',
    'MANAGEMENT',
  ].forEach((t, i) => {
    doc.text(t, lbx - 30, lby - 20 + i * 6.4, {
      width: 60,
      align: 'center',
      lineBreak: false,
    });
  });

  drawStar(doc, lbx, lby + 20, 3.2, gold);

  // ─── Centre seal (between signatures) ────────────────

  const scx = P(647);
  const scy = P(735);
  const sr = 49;

  drawScallop(doc, scx, scy, sr, 30, gold);

  doc.circle(scx, scy, sr - 4).fill(goldLight);
  doc.circle(scx, scy, sr - 6).fill(frameGreen);

  doc
    .lineWidth(0.6)
    .strokeColor(gold)
    .circle(scx, scy, 29)
    .stroke();

  drawArcText(
    doc,
    'INSTITUTE OF ASSETS AND VALUES',
    scx,
    scy,
    32.5,
    'top',
    {
      size: 4.6,
      color: '#FFFFFF',
      spacing: 0.7,
    }
  );

  drawArcText(
    doc,
    'MANAGEMENT OF NIGERIA',
    scx,
    scy,
    40.5,
    'bottom',
    {
      size: 4.6,
      color: '#FFFFFF',
      spacing: 0.7,
    }
  );

  drawEmblem(
    doc,
    scx,
    scy - 6,
    13,
    '#FFFFFF',
    gold
  );

  doc
    .font('Helvetica-Bold')
    .fontSize(6.2)
    .fillColor('#FFFFFF')
    .text(siteShort, scx - 20, scy + 12, {
      width: 40,
      align: 'center',
      lineBreak: false,
    });

  // ─── Footer bar content ─────────────────────────────

  doc
    .font('Helvetica-Bold')
    .fontSize(7.6)
    .fillColor(gold)
    .text(
      ORG_TAGLINE,
      P(240),
      footerTop + 11,
      {
        width: P(700),
        align: 'center',
        lineBreak: false,
      }
    );

  doc
    .font('Helvetica')
    .fontSize(5.2)
    .fillColor('#FFFFFF')
    .text(
      'THIS CERTIFICATE IS THE PROPERTY OF IAVMN AND REMAINS VALID SUBJECT TO ANNUAL SUBSCRIPTION',
      P(250),
      footerTop + 26,
      {
        width: P(660),
        align: 'center',
        lineBreak: false,
      }
    )
    .text(
      "AND COMPLIANCE WITH THE INSTITUTE'S BYE-LAWS AND CODE OF ETHICS.",
      P(250),
      footerTop + 33,
      {
        width: P(660),
        align: 'center',
        lineBreak: false,
      }
    );

  const fgx = P(978);
  const fgy = footerTop + 25;

  drawEmblem(
    doc,
    fgx,
    fgy,
    6.5,
    gold,
    gold
  );

  doc
    .font('Helvetica-Bold')
    .fontSize(5.4)
    .fillColor(gold)
    .text(
      'VERIFY THIS CERTIFICATE ONLINE',
      fgx + 11,
      fgy - 9,
      {
        lineBreak: false,
      }
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#FFFFFF')
    .text(
      displayVerifyHost(settings),
      fgx + 11,
      fgy - 1,
      {
        lineBreak: false,
      }
    );

  // ─── Watermark (admin preview only) ─────────────────

  if (showWatermark) {
    doc.save();

    doc.rotate(-30, {
      origin: [cx, H / 2],
    });

    doc
      .font('Helvetica-Bold')
      .fontSize(120)
      .fillColor('#DC3545')
      .opacity(0.10)
      .text(
        'PREVIEW',
        0,
        H / 2 - 60,
        {
          width: W,
          align: 'center',
        }
      );

    doc.restore();

    doc.save();

    doc
      .rect(border, border, W - border * 2, 20)
      .fill('#DC3545');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#FFFFFF')
      .text(
        'PREVIEW ONLY — NOT VALID FOR OFFICIAL USE',
        0,
        border + 6,
        {
          width: W,
          align: 'center',
          characterSpacing: 1.5,
        }
      );

    doc.restore();
  }

  doc.end();
};