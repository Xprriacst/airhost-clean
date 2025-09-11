import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProperty() {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*');

    if (error) {
      throw error;
    }

    console.log('Propriétés trouvées:', data);
  } catch (error) {
    console.error('Erreur:', error);
  }
}

checkProperty();
