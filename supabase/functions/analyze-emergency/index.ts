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

// Types pour l'analyse d'urgence
interface EmergencyAnalysis {
  isEmergency: boolean;
  emergencyType: 'critical_emergency' | 'ai_uncertain' | 'customer_dissatisfied' | 'accommodation_issue' | null;
  confidence: number;
  reasoning: string;
}

// Fonction pour analyser le contenu avec OpenAI
async function analyzeMessageWithAI(messageContent: string): Promise<EmergencyAnalysis> {
  console.log('Analyse IA du message:', messageContent);
  
  const prompt = `
Analysez ce message de client Airbnb et déterminez s'il s'agit d'une situation d'urgence ou problématique.

Message du client: "${messageContent}"

Catégories d'urgence:
1. "critical_emergency": Urgences critiques (fuite d'eau, incendie, chauffage en panne, problème électrique, urgence médicale, etc.)
2. "ai_uncertain": L'IA précédente n'était pas certaine de sa réponse (présence du caractère invisible \\u200B)
3. "customer_dissatisfied": Client mécontent, insatisfait, en colère, frustré
4. "accommodation_issue": Problème avec le logement (non critique: propreté, équipements cassés, voisinage bruyant, etc.)

Répondez UNIQUEMENT en format JSON strict:
{
  "isEmergency": boolean,
  "emergencyType": "critical_emergency" | "ai_uncertain" | "customer_dissatisfied" | "accommodation_issue" | null,
  "confidence": number (0-1),
  "reasoning": "explication courte"
}

Critères:
- isEmergency = true si c'est une des 4 catégories
- emergencyType = null si isEmergency = false
- confidence = niveau de certitude (0.0 à 1.0)
- reasoning = explication en français en 1-2 phrases max
`;

  try {
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
            content: 'Tu es un expert en analyse de situations d\'urgence pour les locations Airbnb. Tu dois analyser les messages des clients et détecter les problèmes nécessitant une attention immédiate.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('Réponse brute OpenAI:', content);
    
    // Parser la réponse JSON
    const analysis = JSON.parse(content);
    
    // Validation de la réponse
    if (typeof analysis.isEmergency !== 'boolean' || 
        typeof analysis.confidence !== 'number' ||
        typeof analysis.reasoning !== 'string') {
      throw new Error('Format de réponse OpenAI invalide');
    }
    
    console.log('Analyse parsée:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse OpenAI:', error);
    // Retourner une analyse par défaut en cas d'erreur
    return {
      isEmergency: false,
      emergencyType: null,
      confidence: 0.0,
      reasoning: 'Erreur lors de l\'analyse automatique'
    };
  }
}

// Fonction pour détecter l'incertitude de l'IA (caractère invisible)
function detectAIUncertainty(messageContent: string): boolean {
  // Rechercher le caractère zero-width space (U+200B)
  return messageContent.includes('\u200B');
}

// Fonction principale d'analyse
async function analyzeMessage(conversationId: string, messageContent: string) {
  console.log(`Analyse du message pour la conversation ${conversationId}:`, messageContent);
  
  // 1. Détecter l'incertitude IA via le marqueur invisible
  const hasAIUncertainty = detectAIUncertainty(messageContent);
  
  if (hasAIUncertainty) {
    console.log('Incertitude IA détectée via marqueur invisible');
    const analysis = {
      isEmergency: true,
      emergencyType: 'ai_uncertain' as const,
      confidence: 1.0,
      reasoning: 'IA incertaine détectée via marqueur invisible'
    };
    
    return await saveAnalysis(conversationId, messageContent, analysis);
  }
  
  // 2. Analyser avec OpenAI pour les autres types d'urgence
  const analysis = await analyzeMessageWithAI(messageContent);
  
  // 3. Sauvegarder l'analyse
  return await saveAnalysis(conversationId, messageContent, analysis);
}

// Fonction pour sauvegarder l'analyse
async function saveAnalysis(conversationId: string, messageContent: string, analysis: EmergencyAnalysis) {
  try {
    const { data, error } = await supabaseClient
      .from('conversation_analyses')
      .insert({
        conversation_id: conversationId,
        message_content: messageContent,
        is_emergency: analysis.isEmergency,
        emergency_type: analysis.emergencyType,
        confidence_score: analysis.confidence,
        analysis_result: analysis
      })
      .select('*')
      .single();

    if (error) {
      console.error('Erreur lors de la sauvegarde de l\'analyse:', error);
      throw error;
    }

    console.log('Analyse sauvegardée:', data);
    return data;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    throw error;
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

    const { conversationId, messageContent } = await req.json();

    if (!conversationId || !messageContent) {
      return new Response(
        JSON.stringify({ error: 'conversationId et messageContent requis' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Début analyse d\'urgence:', { conversationId, messageContent });

    const result = await analyzeMessage(conversationId, messageContent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: result 
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur dans analyze-emergency:', error);
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