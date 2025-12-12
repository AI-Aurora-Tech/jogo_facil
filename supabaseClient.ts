import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://fyjwicygshdbpepinypg.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5andpY3lnc2hkYnBlcGlueXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3OTk4ODIsImV4cCI6MjA4MDM3NTg4Mn0.rtx81JD3zU9ywY3Q3DwuDDKYzNCdvreBAwLFQ9ZKkVA';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);