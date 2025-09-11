import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_KEY_HERE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTemplatesTable() {
  const sqlPath = path.join(__dirname, '../../../infra/create_templates_table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Erreur lors de la création de la table templates:', error);
    return;
  }

  console.log('Table templates créée avec succès !');
}

createTemplatesTable();
