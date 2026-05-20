# LAeq Processor — SONO / Micromate

Application de démonstration déployable sur GitHub Pages sans installation locale.

## Ce que fait l'application

- Drag & drop d'un fichier CSV.
- Détection automatique du format :
  - **CUBE / SONO** : colonne `Time` + `LAeq`.
  - **Micromate / géophone + micro** : colonne `Mic / Leq / dB(A)`.
- Calcul du **LAeq,T** par moyenne énergétique.
- Deux modes :
  - **Blocs fixes** : 13:00 → 13:15, 13:15 → 13:30, etc.
  - **Glissant** : fenêtre mobile, puis réduction au pas de sortie.
- Affichage du résultat sous forme de tableur.
- Téléchargement du fichier de sortie CSV : `timestamp,LAeq_dBA`.

## Formule utilisée

```text
LAeq,T = 10 log10( mean(10^(Li/10)) )
```

Le code ne fait jamais une moyenne directe des dB.

## Déploiement GitHub Pages sans installation

1. Créer un nouveau repository GitHub.
2. Dans le repository, cliquer sur **Add file → Upload files**.
3. Glisser-déposer le contenu de ce dossier, notamment `index.html` à la racine.
4. Cliquer sur **Commit changes**.
5. Aller dans **Settings → Pages**.
6. Dans **Build and deployment**, choisir :
   - Source : **Deploy from a branch**
   - Branch : `main`
   - Folder : `/root`
7. Ouvrir l'URL GitHub Pages fournie.

## Important

Le fichier `index.html` est autonome : le traitement se fait dans le navigateur.
Aucune donnée n'est envoyée à un serveur.

Le dossier `backend/` contient une première version Lambda Python pour l'étape suivante, mais il n'est pas exécuté par GitHub Pages.
GitHub Pages héberge uniquement du statique : HTML / CSS / JavaScript.

## Paramètres principaux

| Paramètre | Description |
|---|---|
| Type de source | Auto, CUBE/SONO ou Micromate |
| Mode | Blocs fixes ou glissant |
| Fenêtre LAeq | Durée d'intégration, 900 s par défaut |
| Pas de sortie | Pas temporel du fichier résultat |
| Couverture minimale | Pourcentage minimum de données présentes pour valider une période |
| Timestamp résultat | Début ou fin de période |
| Conserver les brutes | Option projet pour la future base de données |

## Prochaine étape backend

Pour passer en architecture cloud complète :

```text
CSV source / base brute
↓
Lambda Python
↓
processed_acoustic_result
↓
Dashboard / export CSV / export DAT
```

Les fichiers du dossier `backend/` sont là comme base pour cette évolution.
