// ============================================================
//  COBRIKA — Supabase Client
//  shared/supabase-client.js
//
//  INSTRUCCIONES:
//  1. Ve a tu proyecto en supabase.com
//  2. Settings → API
//  3. Copia "Project URL" y pégala en SUPABASE_URL
//  4. Copia "anon public" y pégala en SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL      = 'https://daahbtdpkvckxpyufsqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhYWhidGRwa3Zja3hweXVmc3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzEwMjEsImV4cCI6MjA5NDcwNzAyMX0.43wRkPukix0v4GXDCSC2mVhi5aMzs8bbbRMvcESzjKw';

// Importar Supabase desde CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: true,
  },
});

export default supabase;
