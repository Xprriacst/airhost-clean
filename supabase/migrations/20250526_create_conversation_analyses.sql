-- Créer la table conversation_analyses pour le système de détection d'urgence
CREATE TABLE IF NOT EXISTS public.conversation_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL,
    is_emergency BOOLEAN DEFAULT false,
    emergency_type TEXT CHECK (emergency_type IN ('critical_emergency', 'ai_uncertain', 'customer_dissatisfied', 'accommodation_issue')),
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    analysis_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Créer des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_conversation_analyses_conversation_id ON public.conversation_analyses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analyses_is_emergency ON public.conversation_analyses(is_emergency);
CREATE INDEX IF NOT EXISTS idx_conversation_analyses_emergency_type ON public.conversation_analyses(emergency_type);
CREATE INDEX IF NOT EXISTS idx_conversation_analyses_created_at ON public.conversation_analyses(created_at);

-- Activer RLS (Row Level Security)
ALTER TABLE public.conversation_analyses ENABLE ROW LEVEL SECURITY;

-- Politique RLS : Les hôtes peuvent voir les analyses de leurs conversations
CREATE POLICY "Les hôtes peuvent voir les analyses de leurs conversations"
    ON public.conversation_analyses FOR SELECT
    TO authenticated
    USING (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE host_id = auth.uid()
        )
    );

-- Politique RLS : Les hôtes peuvent insérer des analyses pour leurs conversations
CREATE POLICY "Les hôtes peuvent insérer des analyses pour leurs conversations"
    ON public.conversation_analyses FOR INSERT
    TO authenticated
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE host_id = auth.uid()
        )
    );

-- Politique RLS : Les hôtes peuvent mettre à jour les analyses de leurs conversations
CREATE POLICY "Les hôtes peuvent mettre à jour les analyses de leurs conversations"
    ON public.conversation_analyses FOR UPDATE
    TO authenticated
    USING (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE host_id = auth.uid()
        )
    );

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER handle_conversation_analyses_updated_at
    BEFORE UPDATE ON public.conversation_analyses
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Politique pour les service role (Edge Functions)
CREATE POLICY "Service role peut gérer toutes les analyses"
    ON public.conversation_analyses FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);