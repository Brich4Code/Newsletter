
import { createClient } from '@supabase/supabase-js';

// Support both server-side and client-side env vars if needed, though usually strict separation is better.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Prefer service key on server, anon key on client. 
// For this simple setup we might be using one generic env var, but usually:
// Server: SUPABASE_SERVICE_KEY
// Client: VITE_SUPABASE_ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase URL or Key environment variables.");
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseKey || ''
);
