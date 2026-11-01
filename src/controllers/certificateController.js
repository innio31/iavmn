// src/controllers/certificateController.js
// Web-side certificate endpoints. All PDF rendering is delegated to
// ../services/certificate.js — a single source of truth shared with the
// mobile API (apiMemberController.js).

import QRCode from 'qrcode';
import { findMemberById, findMemberByNumber } from '../models/memberModel.js';
import { getAllSettings } from '../models/settingsModel.js';
import {
  streamCertificate,
  buildVerificationUrl,
} from '../services/certificate.js';

// ─── QR code image ─────────────────────────────────────

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
    const isPreview = req.query.preview === '1';

    // For inline preview, override the Content-Disposition that
    // streamCertificate sets. streamCertificate always sets it to
    // 'attachment' (or 'inline' for watermark). We need a third mode:
    // inline without watermark for preview.
    if (isPreview) {
      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) => {
        if (String(name).toLowerCase() === 'content-disposition') {
          return originalSetHeader(
            name,
            `inline; filename="IAVMN-Certificate-${member.member_number.replace(/[\/\\]/g, '-')}.pdf"`
          );
        }
        return originalSetHeader(name, value);
      };
    }

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