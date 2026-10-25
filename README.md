# 🎫 AI Ticket Bot

Bot Discord de **tickets entièrement géré par IA**.  
Plus besoin de staff : l'IA répond automatiquement aux utilisateurs dans leurs tickets.

## Fonctionnalités

- Panneau de tickets avec bouton (setup une seule fois)
- Création automatique d'un salon privé par ticket
- Réponses IA en temps réel (OpenAI / xAI Grok / tout modèle compatible)
- Bouton pour fermer le ticket
- Transcript envoyé en MP à l'utilisateur à la fermeture
- Configuration simple via `.env`

## Installation

1. **Clone le repo**
```bash
git clone https://github.com/paulcazelles5/ModeratorPayout.git
cd ModeratorPayout
```

2. **Installe les dépendances**
```bash
npm install
```

3. **Configure le bot**
```bash
cp .env.example .env
```
Puis édite le fichier `.env` avec tes valeurs.

4. **Invite le bot**
- Va sur https://discord.com/developers/applications
- Crée une application → Bot → copie le token
- Active les **intents** : `Message Content Intent` + `Server Members Intent`
- OAuth2 → URL Generator → scopes `bot` + `applications.commands`
- Permissions recommandées : `Manage Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Manage Messages`

5. **Lance le bot**
```bash
npm start
```

## Utilisation

1. Dans un salon admin, tape `/setup-tickets`
2. Le bot envoie le panneau de tickets
3. Les utilisateurs cliquent sur **Ouvrir un ticket**
4. L'IA prend le relais automatiquement

## Commandes

| Commande | Description |
|----------|-------------|
| `/setup-tickets` | Envoie le panneau de création de tickets |
| `/close` | Ferme le ticket actuel |

## Personnalisation de l'IA

Tu peux changer le modèle et le prompt système dans le `.env` :

```env
AI_MODEL=grok-2-latest
OPENAI_BASE_URL=https://api.x.ai/v1
AI_SYSTEM_PROMPT=Ton prompt personnalisé ici...
```

## Notes

- Les tickets sont créés dans la catégorie indiquée lors du `/setup-tickets` (ou une nouvelle catégorie "Tickets" est créée).
- L'historique de conversation est gardé en mémoire pendant la durée du ticket.
- À la fermeture, un transcript est envoyé en message privé à l'utilisateur.

---

Fait avec ❤️ pour un support 100 % automatisé.
