// src/controllers/dashboardController.js
// Admin dashboard: stats + recent activity.

import { listMessages, countMessages } from '../models/contactModel.js';
import { listApplications, getApplicationCounts } from '../models/applicationModel.js';
import { countSubscribers } from '../models/subscriberModel.js';
import { countPosts } from '../models/postModel.js';
import { listTiers } from '../models/tierModel.js';

export const showDashboard = async (req, res) => {
  const [
    unreadMessages,
    totalMessages,
    recentMessages,
    appCounts,
    recentApplications,
    subscriberCount,
    publishedPosts,
    totalPosts,
    tiers,
  ] = await Promise.all([
    countMessages(true),
    countMessages(false),
    listMessages({ limit: 5 }),
    getApplicationCounts(),
    listApplications({ limit: 5 }),
    countSubscribers(true),
    countPosts(true),
    countPosts(false),
    listTiers(true),
  ]);

  res.render('admin/dashboard', {
    title: 'Dashboard',
    layout: 'layouts/admin',
    stats: {
      unreadMessages,
      totalMessages,
      applications: appCounts,
      subscribers: subscriberCount,
      publishedPosts,
      totalPosts,
      totalTiers: Array.isArray(tiers) ? tiers.length : 0,
    },
    recentMessages,
    recentApplications,
  });
};