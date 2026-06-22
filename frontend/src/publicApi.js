import axios from 'axios';

// Separate axios instance for the customer-facing QR ordering pages.
// IMPORTANT: do NOT reuse `api.js` here — that one auto-attaches the
// staff's Bearer token and redirects to /login on 401, which makes no
// sense for a customer who never logged in at all.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

export default publicApi;
