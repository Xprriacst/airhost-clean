import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function login() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'expertiaen5min@gmail.com',
      password: 'Airhost1702!'
    });

    if (error) {
      throw error;
    }

    console.log('Connecté avec succès:', data);
    return data;
  } catch (error) {
    console.error('Erreur:', error);
  }
}

login();
