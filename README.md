# V-Cards

Flashcard learning app with spaced repetition (SM-2 algorithm).

**[Open App →](https://vapes.github.io/v-cards/)**

## Features

- Create card sets by pasting AI-generated JSON
- Card flip study mode
- SM-2 spaced repetition — cards you struggle with appear more often
- Progress tracking per set
- All data stored locally in the browser (localStorage)

## How to create a card set

1. Click **+ New Set**
2. Enter your topic and click **Generate & Copy Prompt**
3. Paste the prompt into ChatGPT, Claude, or any AI
4. Copy the JSON response and paste it back into the app
5. Save — done

## Deploy

The app deploys automatically to GitHub Pages on every push to `main` via GitHub Actions.

To enable Pages: **Settings → Pages → Source → GitHub Actions**
