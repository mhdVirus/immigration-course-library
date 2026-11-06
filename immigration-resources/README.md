# Course Resource Library

A multilingual course library for books, links, and references organized by the five migration-course modules provided by the owner. Visitors can browse resources and ask a Groq-hosted open-model assistant questions; the owner signs in to add, edit, or remove items.

No course materials or reference links have been supplied yet, so the initial library is intentionally empty.

## Run locally

Requires Node.js 20.6 or newer. From this directory:

1. Copy `.env.example` to `.env`.
2. Set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` of at least 16 characters. Keep `.env` private; it is ignored by Git.
3. Keep `HOST=127.0.0.1` and set `PORT=4173` for local-only use.
4. Create a Groq account, generate an API key from [Groq Console](https://console.groq.com/keys), and set it as `GROQ_API_KEY` in `.env`. Never put the key in browser code or share it in chat.
5. Start this app with `npm run start:local`, then open `http://127.0.0.1:4173`.

The first start copies `data/resources.example.json` to the ignored `data/resources.json`; changes are saved there and survive restarts. Add resource notes or HTTPS links through Owner sign in. The app attempts to index readable web-page text from each link; books and materials without links can be represented with owner-provided notes.

## Hosted AI and privacy

The app sends each question and up to eight selected saved-resource excerpts to Groq's API to generate an answer. The API key remains on the server in `.env`; there are no local model downloads or Ollama requirements. `GROQ_MODEL` can be changed to another active model ID from [Groq's model list](https://console.groq.com/docs/models). Answers are generated in French and cite matching saved resources. Do not add sensitive personal information to questions or resources if you do not want it sent to Groq. Source pages are treated as untrusted reference material, not instructions. HTTPS pages are indexed only after redirect and public-address checks; unsupported or unavailable pages can still be saved with owner-provided notes.

## Public hosting

The included `render.yaml` prepares a free Render web service. Resource records must be stored outside Render's temporary filesystem, so the app supports Supabase Postgres through its REST API:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Push this repository to GitHub, then create a Render Blueprint from the repository. Render will prompt for `ADMIN_USERNAME`, a unique `ADMIN_PASSWORD` of at least 16 characters, `GROQ_API_KEY` (optional until AI answers are needed), `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Keep the Supabase secret/service-role key private and only in Render's environment variables. Never add it to the browser or commit it.
4. After deployment, open the Render-provided HTTPS URL. The site and resource database run independently of your computer.

Render's free web service can sleep after inactivity and take time to wake. Supabase free projects may also pause after extended inactivity; neither provider guarantees a free service will stay available continuously. Owner sign-in sessions are cleared when the app restarts.

No cloud accounts or deployment credentials are configured in this repository, so a public deployment URL still needs to be created from the user's Render and Supabase accounts.

## Checks

Run `npm test` for the server/API tests.
