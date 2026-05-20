# LAeq Processor — GitHub Pages demo

Démo 100% navigateur pour traiter des fichiers CSV SONO / Micromate :

- Drag & drop du CSV
- Détection automatique du type de fichier
- Détection automatique de la résolution source à partir des timestamps
- Lecture des métadonnées Micromate quand disponibles : `SampleRate`, `IntervalSize`, `SerialNumber`, etc.
- Calcul énergétique LAeq,T : `10 * log10(mean(10^(Li/10)))`
- Mode blocs alignés ou glissant
- Pas de sortie configurable : 60 s, 900 s, etc.
- Affichage tableur
- Téléchargement CSV output : `timestamp,LAeq_dBA`
- Interface Français / English

## Déploiement GitHub Pages

Mettre à la racine du repo :

```text
index.html
.nojekyll
README.md
.github/     # optionnel
backend/     # optionnel, non utilisé par GitHub Pages
```

Puis :

1. GitHub > Settings > Pages
2. Source: Deploy from a branch
3. Branch: main
4. Folder: /root

## Important

La version GitHub Pages ne lance pas Python. Tout le calcul se fait dans le navigateur. Les fichiers déposés ne sont pas envoyés à un serveur.

Le dossier `backend/` est conservé uniquement comme base pour une future version Lambda/API Gateway.

## Correction ajoutée

Le champ **Pas de sortie** est maintenant pris en compte même si la fenêtre LAeq reste à 900 s.

Exemple :

- Fenêtre LAeq = 900 s
- Pas de sortie = 60 s

=> l'application calcule une valeur LAeq toutes les minutes dès que les 900 s de données sont couverts.
