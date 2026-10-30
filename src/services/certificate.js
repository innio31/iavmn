// src/services/certificate.js
// Certificate rendering shared by web (/member/certificate/*) and API (/api/v1/member/certificate/*).
// Pure logic + streaming. No req.flash, no redirects — controllers handle those.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

// ─── Helpers ────────────────────────────────────────────

export const fmtDate = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

const resolvePublicFile = (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') return null;
  if (!publicPath.startsWith('/')) return null;
  const rel = publicPath.replace(/^\//, '');
  const abs = path.join(PUBLIC_DIR, rel);
  if (!fs.existsSync(abs)) return null;
  return abs;
};

export const buildVerificationUrl = (settings, memberNumber) => {
  const base = (settings && settings.app_url) || process.env.APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/verify/${encodeURIComponent(memberNumber)}`;
};

// ─── QR buffer ──────────────────────────────────────────

/**
 * Generate a QR PNG buffer for a member's verification URL.
 * @param {object} member
 * @param {object} settings
 * @param {number} width
 * @returns {Promise<Buffer>}
 */
export const generateQrBuffer = async (member, settings, width = 400) => {
  const url = buildVerificationUrl(settings, member.member_number);
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 1,
    width,
    color: { dark: '#25573FFF', light: '#FFFFFFFF' },
  });
};

// ─── PDF streaming ──────────────────────────────────────

/**
 * Stream a certificate PDF to an Express res. Sets headers itself.
 * Caller is responsible for confirming member.status === 'active'.
 *
 * @param {import('express').Response} res
 * @param {object} member
 * @param {object} settings
 */
export const streamCertificate = async (res, member, settings) => {
  const siteName = (settings && settings.site_name) || 'Institute of Assets & Value Management Nigeria';
  const siteShort = (settings && settings.site_short_name) || 'IAVMN';

  const logoPath = resolvePublicFile(settings && settings.site_logo_path);
  const signaturePath = resolvePublicFile(settings && settings.cert_signature_path);

  const verificationUrl = buildVerificationUrl(settings, member.member_number);
  const qrPng = await generateQrBuffer(member, settings, 600);

  const filename = `IAVMN-Certificate-${member.member_number.replace(/[\/\\]/g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `IAVMN Certificate — ${member.full_name}`,
      Author: siteName,
      Subject: 'Certificate of Membership',
      Keywords: `certificate, membership, ${siteShort}, ${member.member_number}`,
      Creator: siteShort,
    },
  });

  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;

  // Background
  doc.rect(0, 0, W, H).fill('#FFFFFF');

  // Borders
  const outerPad = 20;
  const outerBorderColor = '#B9A446';
  const primaryGreen = '#25573F';
  const darkGreen = '#1B4230';

  doc.lineWidth(2).strokeColor(outerBorderColor).rect(outerPad, outerPad, W - outerPad * 2, H - outerPad * 2).stroke();
  doc.lineWidth(0.5).strokeColor(outerBorderColor).rect(outerPad + 5, outerPad + 5, W - (outerPad + 5) * 2, H - (outerPad + 5) * 2).stroke();

  const innerPad = 38;
  doc.lineWidth(0.6).strokeColor(primaryGreen).rect(innerPad, innerPad, W - innerPad * 2, H - innerPad * 2).stroke();

  // Content area
  const contentLeft = innerPad + 40;
  const contentRight = W - innerPad - 40;
  const contentWidth = contentRight - contentLeft;
  const centerX = W / 2;

  let cursorY = innerPad + 40;

  // Header
  if (logoPath) {
    try {
      doc.image(logoPath, centerX - 60, cursorY, { fit: [120, 60], align: 'center', valign: 'center' });
      cursorY += 68;
    } catch {
      cursorY += 8;
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryGreen)
      .text(siteShort, contentLeft, cursorY, { width: contentWidth, align: 'center' });
    cursorY += 28;
  }

  doc.font('Helvetica').fontSize(9).fillColor('#6C757D')
    .text(siteName.toUpperCase(), contentLeft, cursorY, { width: contentWidth, align: 'center', characterSpacing: 1.5 });
  cursorY += 26;

  // Title
  doc.font('Times-Bold').fontSize(34).fillColor(primaryGreen)
    .text('Certificate of Membership', contentLeft, cursorY, { width: contentWidth, align: 'center' });
  cursorY += 44;

  doc.font('Helvetica').fontSize(11).fillColor('#6C757D')
    .text('THIS CERTIFIES THAT', contentLeft, cursorY, { width: contentWidth, align: 'center', characterSpacing: 2 });
  cursorY += 24;

  // Member name
  doc.font('Times-Bold').fontSize(38).fillColor(darkGreen)
    .text(member.full_name, contentLeft + 30, cursorY, { width: contentWidth - 60, align: 'center' });
  cursorY += 52;

  const nameLineWidth = Math.min(contentWidth - 120, 460);
  doc.lineWidth(1.5).strokeColor(outerBorderColor)
    .moveTo(centerX - nameLineWidth / 2, cursorY)
    .lineTo(centerX + nameLineWidth / 2, cursorY)
    .stroke();
  cursorY += 22;

  // Body
  doc.font('Helvetica').fontSize(12).fillColor('#212529')
    .text(
      'is a registered member of the Institute of Assets & Value Management Nigeria, holding the grade of',
      contentLeft + 80,
      cursorY,
      { width: contentWidth - 160, align: 'center', lineGap: 3 }
    );
  cursorY += 32;

  // Tier ribbon
  const tierText = (member.tier_name || 'Member').toUpperCase();
  doc.font('Helvetica-Bold').fontSize(16);
  const tierWidth = doc.widthOfString(tierText) + 60;
  const tierX = centerX - tierWidth / 2;
  const tierY = cursorY;
  const tierH = 30;
  doc.roundedRect(tierX, tierY, tierWidth, tierH, 15).fill(primaryGreen);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16)
    .text(tierText, tierX, tierY + 8, { width: tierWidth, align: 'center' });
  cursorY += tierH + 20;

  // Meta
  const metaParts = [`Member No: ${member.member_number}`, `Issued: ${fmtDate(member.joined_at)}`];
  if (member.expires_at) metaParts.push(`Valid until: ${fmtDate(member.expires_at)}`);
  doc.font('Helvetica').fontSize(10).fillColor('#495057')
    .text(metaParts.join('     •     '), contentLeft + 40, cursorY, { width: contentWidth - 80, align: 'center' });
  cursorY += 30;

  // Footer
  const footerY = H - innerPad - 110;
  const sigLeft = contentLeft + 20;
  const sigWidth = 220;

  if (signaturePath) {
    try {
      doc.image(signaturePath, sigLeft, footerY - 36, { fit: [180, 40], align: 'left' });
    } catch { /* skip unsupported format */ }
  } else {
    doc.lineWidth(1).strokeColor(primaryGreen)
      .moveTo(sigLeft, footerY).lineTo(sigLeft + sigWidth, footerY).stroke();
  }

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#25573F')
    .text('REGISTRAR / CHIEF EXECUTIVE', sigLeft, footerY + 8, { width: sigWidth, align: 'left', characterSpacing: 0.8 });
  doc.font('Helvetica').fontSize(8).fillColor('#6C757D')
    .text(siteShort, sigLeft, footerY + 22, { width: sigWidth, align: 'left', characterSpacing: 0.6 });

  const qrSize = 74;
  const qrX = contentRight - qrSize - 20;
  const qrY = footerY - 30;
  doc.image(qrPng, qrX, qrY, { fit: [qrSize, qrSize] });
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#6C757D')
    .text('SCAN TO VERIFY', qrX, qrY + qrSize + 4, { width: qrSize, align: 'center', characterSpacing: 0.6 });

  doc.font('Helvetica').fontSize(7.5).fillColor('#6C757D')
    .text(`Verification: ${verificationUrl}`, contentLeft + 40, H - innerPad - 22, { width: contentWidth - 80, align: 'center' });

  doc.end();
};