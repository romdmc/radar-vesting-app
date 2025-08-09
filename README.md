# Radar Vesting App

Cette application web simple illustre le concept de "radar à token unlocks" décrit précédemment. Elle ne réalise pas encore de vraies connexions blockchain, mais fournit une structure minimale pour démarrer.

## Description

L'application met à disposition :

- Un serveur HTTP qui fournit une API `GET /api/unlocks` renvoyant des données factices sur les prochains déblocages de jetons (token unlocks).
- Une page web statique à `http://localhost:3000/` qui affiche ces données lorsqu'on clique sur un bouton.

Cette version peut désormais récupérer des données **réelles** de déblocages de jetons via l’API de DropsTab. Si aucune clé API n’est fournie, elle utilise des données d’exemple locales. Le scan on‑chain complet et la logique de short automatique restent à implémenter (par exemple en utilisant des bibliothèques comme `ethers` ou `viem`).

## Structure

- `server.js` — serveur Node.js sans dépendance externe qui sert l'API et les fichiers statiques.
- `public/index.html` — interface utilisateur de base pour afficher les données.

## Utilisation

1. Assurez‑vous d'avoir Node.js installé (`node -v` pour vérifier).
2. (Optionnel) Définissez une clé API DropsTab pour récupérer des données réelles. Obtenez une clé gratuite via le programme Builders de DropsTab (voir section ci‑dessous) et exportez‑la avant de lancer le serveur :

   ```sh
   export DROPSTAB_API_KEY=<VOTRE_CLÉ_API>
   ```

3. Dans un terminal, placez‑vous dans le dossier `radar_vesting_app` et exécutez :

```sh
node server.js
```

4. Ouvrez un navigateur et accédez à `http://localhost:3000`.
5. Dans l’interface, cliquez sur **Charger les unlocks** et **Charger les tokens shortables** pour afficher les données.
6. Utilisez le formulaire de backtest pour simuler une stratégie « short avant / long après » sur les données chargées.

## Note

Cette version est volontairement simplifiée. Pour implémenter un scan temps réel des blockchains et intégrer d’autres fonctionnalités (short automatique, stratégies d’arbitrage, connexion au wallet réel), vous devrez :

- Installer des bibliothèques adaptées (par ex. `ethers`, `viem`, `wagmi`) lorsque vous disposerez d’un accès réseau.
- Écouter les événements vesting via des WebSockets sur les blockchains supportées ou utiliser des services d’indexation (The Graph, Bitquery).
- Étendre l’API pour retourner des données en direct et calculer les scores d’impact.

## Intégration de données réelles

Le serveur peut interroger l’API publique de DropsTab pour récupérer les prochains déblocages de tokens. Pour cela :

1. Demandez une clé API gratuite en rejoignant le **Builders Program** de DropsTab (les étudiants, hackathons et projets open‑source sont éligibles).  
   Consultez l’article de DropsTab sur la création d’un bot d’alertes pour plus de détails【463650480412020†L160-L183】.  
2. Une fois la clé obtenue, exportez‑la dans la variable d’environnement `DROPSTAB_API_KEY` avant de lancer le serveur.  
3. Lorsque la clé est définie, la route `GET /api/unlocks` renverra les données réelles au format utilisé par l’application (sinon elle utilisera les données locales d’exemple).

Les données renvoyées par l’API DropsTab contiennent le nom du token, la date d’unlock et le nombre de tokens libérés【463650480412020†L160-L166】. Le serveur convertit cette réponse en objets compatibles avec l’interface.

## Déploiement / Hébergement

Pour héberger l’application en ligne :

1. **Créer un dépôt Git** pour ce projet (par exemple sur GitHub). Ajoutez tous les fichiers du dossier `radar_vesting_app`, committez et poussez‑les.
2. **Choisir une plateforme d’hébergement** compatible Node.js (par ex. [Vercel](https://vercel.com), [Render](https://render.com) ou [Railway](https://railway.app)). Ces services proposent des plans gratuits et permettent de déployer des applications Node en quelques clics.
3. **Importer le dépôt** depuis la plateforme choisie et configurer une variable d’environnement `DROPSTAB_API_KEY` pour accéder aux données réelles (sans clé, l’application utilisera les données de démonstration).
4. **Déployer l’application**. La plateforme installera automatiquement Node.js et lancera le serveur avec la commande `node server.js`. Une URL publique vous sera alors fournie.

Alternativement, vous pouvez déployer le serveur sur une machine personnelle ou un VPS et configurer un reverse proxy (Nginx) pour servir le contenu.

**Attention :** si vous utilisez l’API de DropsTab en frontal (dans le navigateur), votre clé serait exposée. C’est pourquoi le serveur agit comme un proxy entre votre clé et l’interface.
