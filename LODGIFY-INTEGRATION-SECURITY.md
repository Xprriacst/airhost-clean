# Intégration Lodgify Sécurisée avec Développeur Externe

## 🔒 Stratégies de Sécurisation pour l'API Lodgify

### Problématique
L'API Lodgify donne accès à des données critiques :
- **Propriétés** : Listings, descriptions, amenities
- **Réservations** : Bookings, calendriers, statuts
- **Invités** : Informations personnelles des clients
- **Pricing** : Tarifs et stratégies de prix
- **Messages** : Communications avec les invités
- **Rapports financiers** : Revenus et analytics

## 🛡️ Solutions Sécurisées Recommandées

### Option 1 : Proxy API Sécurisé (RECOMMANDÉE)

Créer une couche intermédiaire qui protège vos clés Lodgify :

```typescript
// Supabase Edge Function : lodgify-proxy
export default async function handler(req: Request) {
  const { endpoint, method, data } = await req.json()
  
  // Validation des endpoints autorisés
  const allowedEndpoints = [
    '/properties',
    '/reservations',
    '/guests'
  ]
  
  if (!allowedEndpoints.some(allowed => endpoint.startsWith(allowed))) {
    return new Response('Endpoint non autorisé', { status: 403 })
  }
  
  // Appel à l'API Lodgify avec votre clé sécurisée
  const response = await fetch(`https://api.lodgify.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${Deno.env.get('LODGIFY_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: data ? JSON.stringify(data) : undefined
  })
  
  return response
}
```

**Avantages :**
- ✅ Votre clé Lodgify reste secrète
- ✅ Contrôle total des endpoints accessibles
- ✅ Logs de tous les accès
- ✅ Possibilité de filtrer/anonymiser les données

### Option 2 : Développement avec Mocks

Le développeur travaille avec des données simulées :

```typescript
// Service Lodgify Mock pour développement
class LodgifyMockService {
  async getProperties() {
    return {
      properties: [
        {
          id: 'mock-1',
          name: 'Appartement Test Paris',
          description: 'Bel appartement pour tests',
          amenities: ['wifi', 'kitchen', 'parking']
        }
      ]
    }
  }
  
  async getReservations() {
    return {
      reservations: [
        {
          id: 'booking-test-1',
          property_id: 'mock-1',
          guest_name: 'Client Test',
          check_in: '2024-01-15',
          check_out: '2024-01-20',
          status: 'confirmed'
        }
      ]
    }
  }
}
```

### Option 3 : Environnement Lodgify de Test

Si Lodgify propose un environnement sandbox :

1. **Créer un compte de test** séparé sur Lodgify
2. **Configurer des propriétés fictives**
3. **Générer une clé API de test**
4. **Le développeur utilise uniquement cette clé**

## 🔧 Implémentation Recommandée : Proxy API

### 1. Créer l'Edge Function Proxy

```typescript
// supabase/functions/lodgify-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const LODGIFY_API_KEY = Deno.env.get('LODGIFY_API_KEY')
const LODGIFY_BASE_URL = 'https://api.lodgify.com/v1'

// Endpoints autorisés pour le développeur
const ALLOWED_ENDPOINTS = [
  'GET:/properties',
  'GET:/properties/{id}',
  'GET:/reservations',
  'GET:/guests',
  'POST:/messages' // Si nécessaire pour les tests
]

serve(async (req) => {
  try {
    const { method, endpoint, data, filters } = await req.json()
    
    // Vérification de l'endpoint
    const requestSignature = `${method}:${endpoint}`
    const isAllowed = ALLOWED_ENDPOINTS.some(allowed => {
      return requestSignature.match(allowed.replace('{id}', '[^/]+'))
    })
    
    if (!isAllowed) {
      return new Response(JSON.stringify({
        error: 'Endpoint non autorisé',
        allowed: ALLOWED_ENDPOINTS
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Log de la requête (pour audit)
    console.log(`Lodgify API Request: ${method} ${endpoint}`, { filters })
    
    // Appel à l'API Lodgify
    const response = await fetch(`${LODGIFY_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${LODGIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    })
    
    let responseData = await response.json()
    
    // Filtrage/anonymisation des données sensibles si nécessaire
    if (endpoint.includes('/guests')) {
      responseData = anonymizeGuestData(responseData)
    }
    
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Erreur proxy Lodgify',
      message: error.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function anonymizeGuestData(data: any) {
  // Anonymiser les données sensibles pour les tests
  if (data.guests) {
    data.guests = data.guests.map((guest: any) => ({
      ...guest,
      email: guest.email ? 'test@example.com' : undefined,
      phone: guest.phone ? '+33600000000' : undefined,
      name: 'Client Test'
    }))
  }
  return data
}
```

### 2. Service côté Frontend

```typescript
// frontend/src/services/lodgify.service.ts
class LodgifyService {
  private proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lodgify-proxy`
  
  private async makeRequest(method: string, endpoint: string, data?: any) {
    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.getSession()?.access_token}`
      },
      body: JSON.stringify({ method, endpoint, data })
    })
    
    return response.json()
  }
  
  async getProperties() {
    return this.makeRequest('GET', '/properties')
  }
  
  async getReservations(propertyId?: string) {
    const endpoint = propertyId 
      ? `/properties/${propertyId}/reservations`
      : '/reservations'
    return this.makeRequest('GET', endpoint)
  }
  
  async getMessages(reservationId: string) {
    return this.makeRequest('GET', `/reservations/${reservationId}/messages`)
  }
}

export default new LodgifyService()
```

## 🔐 Configuration Sécurisée

### Variables d'Environnement

```env
# Dans Supabase Edge Function lodgify-proxy
LODGIFY_API_KEY=VOTRE_VRAIE_CLE_LODGIFY

# Le développeur n'a accès qu'à l'URL du proxy
VITE_LODGIFY_PROXY_URL=https://votre-projet.supabase.co/functions/v1/lodgify-proxy
```

### Permissions Supabase

```sql
-- Créer une policy pour l'accès au proxy Lodgify
CREATE POLICY "lodgify_proxy_access" ON auth.users
FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM authorized_developers
    WHERE service = 'lodgify_proxy'
    AND expires_at > NOW()
  )
);
```

## 📋 Workflow de Développement

### Phase 1 : Développement avec Mocks
```bash
# Le développeur implémente l'intégration avec des données fictives
npm run dev:lodgify-mock
```

### Phase 2 : Tests avec Proxy
```bash
# Une fois l'implémentation terminée, tests avec le proxy
npm run dev:lodgify-proxy
```

### Phase 3 : Validation en Production
```bash
# Vous testez avec vos vraies données
npm run test:lodgify-production
```

## ⚠️ Points de Vigilance

### Ce que le Développeur PEUT faire
- ✅ Développer l'interface utilisateur
- ✅ Implémenter la logique de synchronisation
- ✅ Tester avec des données anonymisées
- ✅ Accéder aux endpoints autorisés via le proxy

### Ce que le Développeur NE PEUT PAS faire
- ❌ Accéder à votre vraie clé API Lodgify
- ❌ Voir les vraies données clients
- ❌ Modifier des réservations réelles
- ❌ Accéder aux rapports financiers
- ❌ Bypasser le système de proxy

## 🚀 Avantages de cette Approche

1. **Sécurité maximale** : Vos clés restent secrètes
2. **Contrôle total** : Vous décidez des endpoints accessibles
3. **Auditabilité** : Logs de tous les accès
4. **Flexibilité** : Possibilité de filtrer/anonymiser les données
5. **Révocable** : Coupure d'accès instantanée si problème

## 📞 Mise en Place

1. **Créer l'Edge Function** `lodgify-proxy` dans Supabase
2. **Configurer votre clé Lodgify** dans les variables d'environnement
3. **Définir les endpoints autorisés** selon vos besoins
4. **Tester le proxy** avec des requêtes de base
5. **Donner l'URL du proxy** au développeur (pas la clé API)

Cette approche vous permet de collaborer efficacement tout en gardant un contrôle total sur vos données Lodgify.
