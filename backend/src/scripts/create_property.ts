import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createProperty() {
  try {
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        host_id: '7d3ca44d-f2d2-4109-8885-8ef004ee63ff',
        name: 'Appartement Paris Centre',
        description: 'Bel appartement au cœur de Paris',
        address: '123 Rue de Rivoli, 75001 Paris',
        type: 'apartment'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('Propriété créée avec succès:', property);
    return property;
  } catch (error) {
    console.error('Erreur:', error);
  }
}

createProperty();
