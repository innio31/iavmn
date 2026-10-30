// src/controllers/certificateController.js
// Generates the member certificate as a PDF (pdfkit) and the QR code image (qrcode).

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

// ─── Helpers ────────────────────────────────────────────

const fmtDate = (dt) => {
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

const buildVerificationUrl = (settings, memberNumber) => {
  const base = (settings && settings.app_url) || process.env.APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/verify/${encodeURIComponent(memberNumber)}`;
};

/**
 * Draw a text block that must stay on ONE line, shrinking font size to fit.
 * Returns the font size used.
 */
const drawSingleLineText = (doc, text, x, y, maxWidth, baseSize, options = {}) => {
  const font = options.font || 'Helvetica-Bold';
  const color = options.color || '#1B4230';
  const align = options.align || 'center';

  let size = baseSize;
  doc.font(font).fontSize(size);
  while (size > 6 && doc.widthOfString(text) > maxWidth) {
    size -= 0.5;
    doc.fontSize(size);
  }
  doc.fillColor(color).text(text, x, y, {
    width: maxWidth,
    align: align,
    lineBreak: false,
    ellipsis: true,
  });
  return size;
};

// ─── QR code image ──────────────────────────────────────

export const serveQrCode = async (req, res) => {
  try {
    const member = await findMemberById(req.member.id);
    if (!member) return res.status(404).end();

    const settings = await getAllSettings();
    const url = buildVerificationUrl(settings, member.member_number);

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
      req.flash('error', 'Your membership must be active to download a certificate.');
      return res.redirect('/member/certificate');
    }

    const settings = await getAllSettings();
    await streamCertificate(res, member, settings, { watermark: false });
  } catch (err) {
    console.error('[certificate pdf] failed:', err.message);
    if (!res.headersSent) {
      req.flash('error', 'Could not generate your certificate. Please try again.');
      res.redirect('/member/certificate');
    }
  }
};

// ─── Certificate PDF: public download (by member number) ─

export const downloadPublicCertificatePdf = async (req, res, next) => {
  try {
    const member = await findMemberByNumber(req.params.memberNumber);
    if (!member) return next();
    if (member.status !== 'active') return next();

    const settings = await getAllSettings();
    await streamCertificate(res, member, settings, { watermark: false });
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
    await streamCertificate(res, member, settings, { watermark: true });
  } catch (err) {
    console.error('[preview certificate] failed:', err.message);
    if (!res.headersSent) {
      req.flash('error', 'Could not generate the certificate preview.');
      res.redirect('/admin/members');
    }
  }
};

// ─── Core PDF rendering ─────────────────────────────────

const streamCertificate = async (res, member, settings, opts = {}) => {
  const showWatermark = Boolean(opts.watermark);

  const siteName = (settings && settings.site_name) || 'Institute of Assets & Value Management Nigeria';
  const siteShort = (settings && settings.site_short_name) || 'IAVMN';

  const logoPath = resolvePublicFile(settings && settings.site_logo_path);
  const registrarSigPath = resolvePublicFile(settings && settings.cert_signature_registrar_path);
  const presidentSigPath = resolvePublicFile(settings && settings.cert_signature_president_path);

  const registrarName = (settings && settings.cert_registrar_name) || '';
  const registrarTitle = (settings && settings.cert_registrar_title) || 'Registrar / Chief Executive';
  const presidentName = (settings && settings.cert_president_name) || '';
  const presidentTitle = (settings && settings.cert_president_title) || 'President / Chairman of Council';

  const verificationUrl = buildVerificationUrl(settings, member.member_number);

  const qrPng = await QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 1,
    width: 600,
    color: { dark: '#25573FFF', light: '#FFFFFFFF' },
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
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: showWatermark
        ? `IAVMN Certificate PREVIEW — ${member.full_name}`
        : `IAVMN Certificate — ${member.full_name}`,
      Author: siteName,
      Subject: showWatermark ? 'Certificate Preview (NOT VALID)' : 'Certificate of Membership',
      Keywords: showWatermark
        ? `preview, not valid, ${member.member_number}`
        : `certificate, membership, ${siteShort}, ${member.member_number}`,
      Creator: siteShort,
    },
  });

  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;

  const primaryGreen = '#25573F';
  const darkGreen = '#1B4230';
  const gold = '#B9A446';

  doc.rect(0, 0, W, H).fill('#FFFFFF');

  const outerPad = 20;
  doc.lineWidth(2).strokeColor(gold).rect(outerPad, outerPad, W - outerPad * 2, H - outerPad * 2).stroke();
  doc.lineWidth(0.5).strokeColor(gold).rect(outerPad + 5, outerPad + 5, W - (outerPad + 5) * 2, H - (outerPad + 5) * 2).stroke();

  const innerPad = 38;
  doc.lineWidth(0.6).strokeColor(primaryGreen).rect(innerPad, innerPad, W - innerPad * 2, H - innerPad * 2).stroke();

  const contentLeft = innerPad + 40;
  const contentRight = W - innerPad - 40;
  const contentWidth = contentRight - contentLeft;
  const centerX = W / 2;

  let cursorY = innerPad + 34;

  // ─── Header ───
  if (logoPath) {
    try {
      doc.image(logoPath, centerX - 60, cursorY, { fit: [120, 55], align: 'center', valign: 'center' });
      cursorY += 62;
    } catch (e) {
      cursorY += 6;
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryGreen)
      .text(siteShort, contentLeft, cursorY, { width: contentWidth, align: 'center' });
    cursorY += 26;
  }

  doc.font('Helvetica').fontSize(9).fillColor('#6C757D')
    .text(siteName.toUpperCase(), contentLeft, cursorY, { width: contentWidth, align: 'center', characterSpacing: 1.5 });
  cursorY += 24;

  // ─── Title ───
  doc.font('Times-Bold').fontSize(32).fillColor(primaryGreen)
    .text('Certificate of Membership', contentLeft, cursorY, { width: contentWidth, align: 'center' });
  cursorY += 40;

  doc.font('Helvetica').fontSize(10).fillColor('#6C757D')
    .text('THIS CERTIFIES THAT', contentLeft, cursorY, { width: contentWidth, align: 'center', characterSpacing: 2 });
  cursorY += 22;

  // ─── Member name ───
  doc.font('Times-Bold').fontSize(36).fillColor(darkGreen)
    .text(member.full_name, contentLeft + 30, cursorY, { width: contentWidth - 60, align: 'center' });
  cursorY += 48;

  const nameLineWidth = Math.min(contentWidth - 120, 460);
  doc.lineWidth(1.5).strokeColor(gold)
    .moveTo(centerX - nameLineWidth / 2, cursorY)
    .lineTo(centerX + nameLineWidth / 2, cursorY)
    .stroke();
  cursorY += 20;

  // ─── Body text ───
  doc.font('Helvetica').fontSize(11).fillColor('#212529')
    .text(
      'is a registered member of the Institute of Assets & Value Management Nigeria, holding the grade of',
      contentLeft + 80, cursorY,
      { width: contentWidth - 160, align: 'center', lineGap: 3 }
    );
  cursorY += 28;

  // ─── Tier ribbon ───
  const tierText = (member.tier_name || 'Member').toUpperCase();
  doc.font('Helvetica-Bold').fontSize(15);
  const tierWidth = doc.widthOfString(tierText) + 56;
  const tierX = centerX - tierWidth / 2;
  const tierY = cursorY;
  const tierH = 28;
  doc.roundedRect(tierX, tierY, tierWidth, tierH, 14).fill(primaryGreen);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15)
    .text(tierText, tierX, tierY + 7, { width: tierWidth, align: 'center' });
  cursorY += tierH + 18;

  // ─── Meta line ───
  const metaParts = [
    `Member No: ${member.member_number}`,
    `Issued: ${fmtDate(member.joined_at)}`,
  ];
  if (member.expires_at) {
    metaParts.push(`Valid until: ${fmtDate(member.expires_at)}`);
  }
  doc.font('Helvetica').fontSize(9.5).fillColor('#495057')
    .text(metaParts.join('     •     '), contentLeft + 40, cursorY, {
      width: contentWidth - 80,
      align: 'center',
    });
  cursorY += 26;

  // ─── Footer: signatures + QR ───
  const footerY = H - innerPad - 90;
  const sigWidth = 190;
  const sigHeight = 44;   // <-- increased from 32 to 44

  // Registrar (left)
  const leftSigX = contentLeft + 20;
  if (registrarSigPath) {
    try {
      doc.image(registrarSigPath, leftSigX, footerY - sigHeight - 2, {
        fit: [sigWidth, sigHeight], align: 'center', valign: 'bottom',
      });
    } catch (e) { /* skip */ }
  } else {
    doc.lineWidth(0.8).strokeColor(primaryGreen)
      .moveTo(leftSigX, footerY).lineTo(leftSigX + sigWidth, footerY).stroke();
  }

  // Registrar name — single line, auto-shrink to fit
  let regNameUsedSize = 9;
  if (registrarName) {
    regNameUsedSize = drawSingleLineText(doc, registrarName, leftSigX - 10, footerY + 6, sigWidth + 20, 9, {
      font: 'Helvetica-Bold',
      color: darkGreen,
      align: 'center',
    });
  }
  doc.font('Helvetica').fontSize(8).fillColor('#6C757D')
    .text(registrarTitle.toUpperCase(), leftSigX - 10, footerY + 20, {
      width: sigWidth + 20, align: 'center', characterSpacing: 0.5, lineBreak: false, ellipsis: true,
    });

  // President (right)
  const rightSigX = contentRight - sigWidth - 20;
  if (presidentSigPath) {
    try {
      doc.image(presidentSigPath, rightSigX, footerY - sigHeight - 2, {
        fit: [sigWidth, sigHeight], align: 'center', valign: 'bottom',
      });
    } catch (e) { /* skip */ }
  } else {
    doc.lineWidth(0.8).strokeColor(primaryGreen)
      .moveTo(rightSigX, footerY).lineTo(rightSigX + sigWidth, footerY).stroke();
  }

  // President name — single line, auto-shrink to fit
  if (presidentName) {
    drawSingleLineText(doc, presidentName, rightSigX - 10, footerY + 6, sigWidth + 20, 9, {
      font: 'Helvetica-Bold',
      color: darkGreen,
      align: 'center',
    });
  }
  doc.font('Helvetica').fontSize(8).fillColor('#6C757D')
    .text(presidentTitle.toUpperCase(), rightSigX - 10, footerY + 20, {
      width: sigWidth + 20, align: 'center', characterSpacing: 0.5, lineBreak: false, ellipsis: true,
    });

  // QR (center)
  const qrSize = 66;
  const qrX = centerX - qrSize / 2;
  const qrY = footerY - qrSize + 4;

  doc.image(qrPng, qrX, qrY, { fit: [qrSize, qrSize] });

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#6C757D')
    .text('SCAN TO VERIFY', qrX - 20, qrY + qrSize + 4, {
      width: qrSize + 40, align: 'center', characterSpacing: 0.6,
    });

  // ─── Verification URL ───
  doc.font('Helvetica').fontSize(7).fillColor('#6C757D')
    .text(`Verification: ${verificationUrl}`, contentLeft + 40, H - innerPad - 20, {
      width: contentWidth - 80,
      align: 'center',
    });

  // ─── Watermark (admin preview only) ───
  if (showWatermark) {
    doc.save();
    doc.rotate(-30, { origin: [centerX, H / 2] });
    doc.font('Helvetica-Bold').fontSize(120).fillColor('#DC3545')
      .opacity(0.10)
      .text('PREVIEW', 0, H / 2 - 60, {
        width: W,
        align: 'center',
      });
    doc.restore();

    doc.save();
    doc.rect(outerPad + 6, outerPad + 6, W - (outerPad + 6) * 2, 26).fill('#DC3545');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF')
      .text('PREVIEW ONLY — NOT VALID FOR OFFICIAL USE', contentLeft, outerPad + 14, {
        width: contentWidth,
        align: 'center',
        characterSpacing: 1.5,
      });
    doc.restore();
  }

  doc.end();
};