// src/controllers/homeController.js
// Public homepage: gathers all data needed and renders home.ejs.

import { listSlides } from '../models/heroModel.js';
import { listTestimonials } from '../models/testimonialModel.js';
import { listTiers } from '../models/tierModel.js';
import { listPosts } from '../models/postModel.js';
import { getSetting } from '../models/settingsModel.js'; // <-- New import

export const showHome = async (req, res) => {
  const [slides, testimonials, tiers, latestPosts, globalFormFee] = await Promise.all([
    listSlides(true),
    listTestimonials(true),
    listTiers(true),
    listPosts({ publishedOnly: true, limit: 3 }),
    getSetting('registration_form_fee'), // <-- New fetch
  ]);

  res.render('home', {
    title: 'Home',
    slides,
    testimonials,
    tiers,
    latestPosts,
    globalFormFee: globalFormFee || '20000', // <-- Pass to view
  });
};