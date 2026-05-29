// API base URL — empty string in dev (Vite proxy handles /api/* → localhost:5001)
// Set VITE_API_URL env var in Vercel dashboard to point at the Render backend.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export default API_BASE
