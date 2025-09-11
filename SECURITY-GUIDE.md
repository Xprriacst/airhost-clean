# Guide de Sécurité - Collaboration avec Développeur Externe

## 🔒 Stratégie de Sécurité pour le Développement

### 1. Environnements Séparés

#### Environnement de Développement (DEV)
- **Projet Supabase dédié** : Créer un nouveau projet Supabase uniquement pour le développeur
- **Base de données isolée** : Aucune donnée de production
- **Clés API distinctes** : Clés OpenAI, WhatsApp, Firebase séparées
- **Domaine de test** : Sous-domaine ou domaine temporaire

#### Environnement de Test/Recette (STAGING)
- **Projet Supabase intermédiaire** : Pour validation avant production
- **Données anonymisées** : Copie des données prod sans informations sensibles
- **Tests d'intégration** : Validation complète des fonctionnalités

#### Environnement de Production (PROD)
- **Accès restreint** : Vous seul avez accès
- **Déploiement contrôlé** : Validation manuelle avant mise en prod

### 2. Gestion des Accès Supabase

#### Pour le Développeur (Environnement DEV)
```bash
# Créer un nouveau projet Supabase pour le dev
# Nom suggéré : "airhost-dev-[nom-developpeur]"
# Région : même que prod pour cohérence
```

#### Permissions recommandées
- **Database** : Accès complet au projet DEV uniquement
- **Auth** : Configuration des utilisateurs de test
- **Edge Functions** : Déploiement et test des fonctions
- **Storage** : Si nécessaire pour les fichiers
- **Pas d'accès** : Aucun accès aux projets STAGING/PROD

### 3. Configuration Sécurisée

#### Variables d'Environnement DEV
```env
# Projet Supabase DEV du développeur
SUPABASE_URL=https://[projet-dev].supabase.co
SUPABASE_ANON_KEY=[clé-anon-dev]
SUPABASE_SERVICE_ROLE_KEY=[clé-service-dev]

# Clés API de test (quotas limités)
OPENAI_API_KEY=[clé-test-openai]
WHATSAPP_VERIFY_TOKEN=[token-test-whatsapp]

# Firebase de test
FIREBASE_API_KEY=[clé-test-firebase]
FCM_PROJECT_ID=[projet-test-firebase]
```

#### Données de Test
- **Utilisateurs fictifs** : Créer des comptes de test
- **Propriétés d'exemple** : Appartements avec données anonymes
- **Conversations simulées** : Messages de test pour validation
- **Pas de vraies données** : Aucune information client réelle

## 🛡️ Bonnes Pratiques de Collaboration

### 1. Workflow Git Sécurisé

#### Branches de Travail
```bash
# Le développeur travaille sur des branches feature
git checkout -b feature/nouvelle-fonctionnalite
git checkout -b fix/correction-bug
git checkout -b improvement/optimisation
```

#### Pull Requests Obligatoires
- **Review systématique** : Vous validez tous les PR
- **Tests requis** : Fonctionnalités testées en DEV
- **Documentation** : Changements documentés
- **Pas de merge direct** : Aucun accès direct à main

### 2. Gestion des Secrets

#### Ce que le Développeur NE DOIT JAMAIS avoir
- Clés API de production
- Tokens WhatsApp de production
- Accès aux bases de données de production
- Informations clients réelles
- Clés Firebase de production

#### Ce que le Développeur PEUT avoir
- Clés de test avec quotas limités
- Accès au projet Supabase DEV
- Documentation technique
- Code source nettoyé

### 3. Communication et Suivi

#### Réunions Régulières
- **Point hebdomadaire** : Avancement et blocages
- **Demo des fonctionnalités** : Validation en environnement DEV
- **Review de code** : Explication des changements

#### Documentation Obligatoire
- **Changelog** : Toutes les modifications documentées
- **Tests** : Procédures de test pour chaque feature
- **Déploiement** : Instructions de mise en production

## 🚀 Processus de Déploiement Sécurisé

### 1. Développement (DEV)
```bash
# Le développeur travaille en local
npm run dev

# Tests sur son projet Supabase DEV
# Validation des fonctionnalités
```

### 2. Validation (STAGING)
```bash
# Vous déployez sur l'environnement de recette
# Tests d'intégration complets
# Validation des performances
```

### 3. Production (PROD)
```bash
# Vous seul déployez en production
# Sauvegarde avant déploiement
# Monitoring post-déploiement
```

## 📋 Checklist de Sécurité

### Avant de Commencer
- [ ] Projet Supabase DEV créé pour le développeur
- [ ] Clés API de test configurées (quotas limités)
- [ ] Données de test créées (aucune donnée réelle)
- [ ] Repository GitHub avec accès contrôlé
- [ ] Contrat/NDA signé avec clauses de confidentialité

### Pendant le Développement
- [ ] Reviews de code systématiques
- [ ] Tests en environnement DEV uniquement
- [ ] Aucun secret en dur dans le code
- [ ] Documentation des changements
- [ ] Branches feature isolées

### Avant Mise en Production
- [ ] Tests complets en STAGING
- [ ] Validation sécurité du code
- [ ] Sauvegarde des données de production
- [ ] Plan de rollback préparé
- [ ] Monitoring activé

## 🔧 Configuration Technique Recommandée

### Projet Supabase DEV
```sql
-- Créer des utilisateurs de test
INSERT INTO auth.users (email, encrypted_password) 
VALUES ('dev@test.com', 'mot_de_passe_hashé');

-- Créer des propriétés de test
INSERT INTO properties (name, description, ai_instructions)
VALUES ('Appartement Test', 'Propriété pour développement', 'Instructions IA de test');

-- Créer des conversations de test
INSERT INTO conversations (guest_phone, property_id)
VALUES ('+33600000000', 'id_propriete_test');
```

### Limitations Recommandées
- **Quotas OpenAI** : Limiter à 100$/mois maximum
- **Utilisateurs Supabase** : Maximum 10 utilisateurs de test
- **Messages WhatsApp** : Utiliser des numéros de test uniquement
- **Stockage** : Limiter à 1GB pour le projet DEV

## 🚨 Signaux d'Alerte

### Arrêter Immédiatement Si
- Le développeur demande accès à la production
- Tentative d'accès aux vraies données clients
- Clés API de production dans le code
- Bypass des processus de review
- Demande d'accès aux systèmes de paiement

### Actions d'Urgence
1. **Révoquer tous les accès** immédiatement
2. **Changer toutes les clés API** de production
3. **Auditer les logs** d'accès Supabase
4. **Vérifier l'intégrité** des données
5. **Documenter l'incident** pour référence

## 📞 Contacts d'Urgence

En cas de problème de sécurité :
1. **Supabase Support** : support@supabase.io
2. **OpenAI Support** : support@openai.com
3. **Meta Business Support** : business.facebook.com/help
4. **GitHub Security** : security@github.com

---

**Important** : Ce guide doit être partagé avec le développeur et accepté avant le début du travail. Toute violation de ces règles entraîne l'arrêt immédiat de la collaboration.
