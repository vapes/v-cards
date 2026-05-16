# V-Cards — Flashcard Learning App

A minimalist flashcard app with spaced repetition, built with plain HTML/CSS/JS — no build step, no dependencies.

**[Open App](https://vapes.github.io/v-cards/)**

## Features

- Create card sets from AI-generated JSON
- SM-2 spaced repetition algorithm schedules reviews automatically
- Flip cards, mark as Know / Don't Know, track accuracy per session
- Progress saved in browser localStorage — no account needed

## How to Use

1. Open the app and click **+ New Set**
2. Paste a JSON array of flashcards in the format:
   ```json
   [
     { "id": "1", "front": "Hello", "back": "Привет" },
     { "id": "2", "front": "World", "back": "Мир" }
   ]
   ```
3. Start a study session — the app will schedule reviews based on your performance

## Project Structure

```
index.html      — home page (card sets list)
edit.html       — create / edit a card set
study.html      — study session with flip cards
css/style.css   — all styles
js/storage.js   — localStorage helpers
js/sm2.js       — SM-2 algorithm
js/home.js      — home page logic
js/edit.js      — editor logic
js/study.js     — study session logic
```

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via `.github/workflows/deploy.yml`.
