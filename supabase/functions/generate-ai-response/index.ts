import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Créer le client Supabase avec service_role
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY non configurée')
  throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante')
}

if (!openaiApiKey) {
  console.error('OPENAI_API_KEY non configurée')
  throw new Error('OPENAI_API_KEY manquante')
}

const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Caractère invisible pour marquer l'incertitude de l'IA
const UNCERTAINTY_MARKER = '\u200B'; // Zero-width space

// Fonction pour analyser l'incertitude et déclencher l'analyse d'urgence si nécessaire
async function notifyUncertainty(conversationId: string, response: string) {
  if (response.includes(UNCERTAINTY_MARKER)) {
    console.log('Incertitude IA détectée, déclenchement de l\'analyse d\'urgence');
    
    try {
      // Appeler la fonction d'analyse d'urgence
      const { error } = await supabaseClient.functions.invoke('analyze-emergency', {
        body: {
          conversationId,
          messageContent: response
        }
      });
      
      if (error) {
        console.error('Erreur lors de l\'appel à analyze-emergency:', error);
      }
    } catch (error) {
      console.error('Erreur lors de la notification d\'incertitude:', error);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Méthode non autorisée', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const { apartmentId, conversationId } = await req.json();

    if (!apartmentId || !conversationId) {
      return new Response(
        JSON.stringify({ error: 'apartmentId et conversationId requis' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Génération de réponse IA pour:', { apartmentId, conversationId });

    // 1. Récupérer les informations de la propriété
    const { data: property, error: propertyError } = await supabaseClient
      .from('properties')
      .select('*')
      .eq('id', apartmentId)
      .single();

    if (propertyError) {
      console.error('Erreur lors de la récupération de la propriété:', propertyError);
      throw new Error('Propriété non trouvée');
    }

    // 2. Récupérer les derniers messages de la conversation
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Erreur lors de la récupération des messages:', messagesError);
      throw new Error('Messages non trouvés');
    }

    // 3. Construire le contexte de conversation
    const conversationContext = messages
      .reverse()
      .map(msg => `${msg.direction === 'inbound' ? 'Client' : 'Hôte'}: ${msg.content}`)
      .join('\n');

    // 4. Construire le prompt pour OpenAI
    const prompt = `
Tu es un assistant IA pour un hôte Airbnb. Analyse la conversation et génère une réponse appropriée.

Informations sur la propriété:
- Nom: ${property.name || 'Non spécifié'}
- Adresse: ${property.address || 'Non spécifiée'}
- Détails: ${property.details || 'Aucun détail disponible'}

Conversation récente:
${conversationContext}

Instructions importantes:
1. Réponds de manière professionnelle et amicale
2. Utilise les informations de la propriété si pertinent
3. Si tu n'es pas certain d'une information, insère le caractère invisible "${UNCERTAINTY_MARKER}" dans ta réponse
4. Limite ta réponse à 200 mots maximum
5. Réponds uniquement en français

Génère une réponse appropriée:`;

    // 5. Appeler OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant professionnel pour hôtes Airbnb. Tu dois fournir des réponses utiles et précises aux clients.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('Réponse IA générée:', aiResponse);

    // 6. Vérifier l'incertitude et déclencher l'analyse si nécessaire
    await notifyUncertainty(conversationId, aiResponse);

    return new Response(
      JSON.stringify({ 
        response: aiResponse 
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur dans generate-ai-response:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})