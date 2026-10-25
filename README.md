# 🎫 AI Ticket Bot

Bot Discord de **tickets entièrement géré par IA**.  
Plus besoin de staff : l'IA répond automatiquement aux utilisateurs dans leurs tickets.

## Fonctionnalités

- Panneau de tickets avec bouton
- Création automatique d'un salon privé par ticket
- Réponses IA en temps réel (Groq / OpenAI / xAI / tout compatible)
- Bouton + commande `/close` pour fermer
- Transcript envoyé en MP à la fermeture

## Déploiement sur Railway (recommandé)

1. Va sur [railway.app](https://railway.app) et connecte ton compte GitHub
2. Clique sur **New Project** → **Deploy from GitHub repo**
3. Sélectionne `paulcazelles5/ModeratorPayout`
4. Une fois le service créé, va dans l'onglet **Variables** et ajoute les variables ci-dessous
5. Railway déploie automatiquement. Le bot se connecte dès que les variables sont bonnes.

### Variables à définir sur Railway

| Variable | Exemple / Valeur |
|----------|------------------|
| `DISCORD_TOKEN` | Ton token bot Discord |
| `CLIENT_ID` | L'Application ID du bot |
| `GUILD_ID` | L'ID de ton serveur Discord |
| `OPENAI_API_KEY` | Ta clé Groq (`gsk_...`) |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `AI_MODEL` | `llama-3.3-70b-versatile` |
| `AI_SYSTEM_PROMPT` | (optionnel) Ton prompt personnalisé |

> **Important** : Active les intents **Message Content Intent** et **Server Members Intent** sur le [Developer Portal](https://discord.com/developers/applications).

## Installation locale

```bash
git clone https://github.com/paulcazelles5/ModeratorPayout.git
cd ModeratorPayout
npm install
cp .env.example .env
# Édite .env avec tes valeurs
npm start
```

## Utilisation

1. Dans un salon admin → `/setup-tickets`
2. Les utilisateurs cliquent sur **Ouvrir un ticket**
3. L'IA répond automatiquement

## Commandes

| Commande | Description |
|----------|-------------|
| `/setup-tickets` | Envoie le panneau de tickets |
| `/close` | Ferme le ticket actuel |

---

Fait pour un support 100 % automatisé.
