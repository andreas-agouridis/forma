<p align="center">
  <img src="logo.png" alt="Forma logo" width="160" height="160">
</p>

<h1 align="center">Forma</h1>

<p align="center">
  <strong>Ideas into images. Just like magic.</strong><br>
  A browser-based AI image generator and creative studio.<br><br>
  Made by <strong>Andreas Agouridis</strong>.
</p>

---

Forma turns text prompts into images through your own [Pollinations](https://enter.pollinations.ai) account. Built with plain HTML, CSS and JavaScript, it runs on static hosting with no build step, package installation or application server.

## Features

- **Five aesthetics:** Auto, Realistic, 3D render, Anime and Digital art.
- **Model selection:** Z-Image Turbo, FLUX.1 Schnell, FLUX.2 Klein, FLUX.2 Pro and GPT Image 1 Mini, with provider catalog refresh.
- **Prompt assistance:** optional AI refinement with undo, local composition guidance and ready-to-use inspiration prompts.
- **Creative controls:** four aspect ratios, lighting, composition, exclusions and seeds on supported models. Quality controls are available for GPT Image 1 Mini.
- **Image workspace:** full-size preview, original-image downloads, prompt copying and reusable settings.
- **Local history:** drafts and up to 12 recent creations stored in your browser when storage is available.
- **Request recovery:** cancellation, retries for temporary failures and provider-specific error messages.
- **Responsive interface:** dark styling, keyboard shortcuts, accessible labels and status messages.
- **Built-in documentation:** a prompt guide, privacy information and a static-site publishing kit.

The studio interface is free to use. Image generation and AI prompt refinement use Pollinations; provider credits, model availability, permissions and rate limits apply.

## Run locally

Requirements: a modern browser and Python 3 for the example local server. Internet access and a Pollinations account are needed for AI features.

1. Clone this repository or download and extract its ZIP.
2. Open a terminal in the project folder.
3. Start a local static server:

   ```sh
   python -m http.server 8000 --bind 127.0.0.1
   ```

4. Open **http://127.0.0.1:8000**.
5. Select **Connect AI**, approve the matching connection code on Pollinations, and return to Forma.
6. Describe an image, choose a style and model, then select **Generate image**.

Use **Ctrl+Enter** on Windows/Linux or **Command+Enter** on macOS to generate. Stop the local server with **Ctrl+C**.

## Configuration

Optional public settings live in [`site-config.js`](site-config.js):

| Setting | Purpose |
| --- | --- |
| `pollinationsClientId` | A registered Pollinations App Key for app attribution during connection. Leave empty to use the default device connection. |
| `canonicalUrl` | The public site base URL, including its repository subdirectory when applicable. Leave empty during local development. |

For production metadata embedded directly in the HTML, use the publishing kit described below.

Access tokens are entered or authorized through the interface and remain in page memory. Refreshing the page requires reconnecting. Do not put personal API keys or access tokens in public configuration.

## Publish on GitHub Pages

1. Create a GitHub repository and upload this project's files and folders to its root, including the PNG logo and dotfiles.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch containing the files (usually `main`), choose **/ (root)** and save.
5. Wait for GitHub Pages to finish deploying, then open the URL shown in Settings.

A project site normally uses `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. Asset paths are relative, so the studio supports a repository subdirectory. The included `.nojekyll` file lets GitHub Pages serve the static files directly.

### Production metadata and sharing artwork

Once you know your public site URL:

1. Run the local server and open **http://127.0.0.1:8000/publish.html**.
2. Enter the full production URL, including any repository subdirectory.
3. Select **Download publishing ZIP**.
4. Extract the ZIP over the corresponding website files in your repository, review the changes and upload them to GitHub.

The kit stamps canonical URLs and social metadata into the public pages and generates `social-preview.png`, `favicon.png`, `apple-touch-icon.png`, `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt`.

Search engines read `robots.txt` at the **domain root**. For a project hosted under a repository subdirectory, the generated file inside that subdirectory is not the domain-root robots file; you can submit the generated sitemap URL directly to search engines. If you control the domain root, follow the publishing kit's instructions for placing or merging the discovery files there.

## Project structure

```text
.
├── index.html              # Image studio
├── guide.html              # Prompt guide and troubleshooting
├── privacy.html            # Data handling information
├── publish.html            # Browser-based publishing kit
├── style.css               # Shared styling and responsive layouts
├── script.js               # Studio UI and generation workflow
├── studio-core.js          # Models, prompts and provider request logic
├── connection.js           # Pollinations authorization
├── storage.js              # Drafts and local image history
├── discovery.js            # Runtime discovery metadata
├── site-config.js          # Optional public configuration
├── publish.js              # Publishing ZIP and artwork generation
├── logo.png                # 512 × 512 Forma logo
├── scripts/
│   └── generate-logo.py    # Rebuild the PNG using Python's standard library
├── .gitattributes          # Text normalization and binary asset handling
├── .gitignore              # Local files excluded from version control
├── .nojekyll               # Static GitHub Pages hosting
└── README.MD
```

## Development

Edit the HTML, CSS or JavaScript and refresh your local browser. There is no bundler or dependency installation step.

Regenerate the included logo from the project root with:

```sh
python scripts/generate-logo.py
```

Before submitting changes, check the studio, prompt guide and privacy page at desktop and mobile widths. For changes to AI features, verify connection, generation, downloads and history with your own Pollinations account. For publishing changes, generate a ZIP and check its deployed paths.

## Privacy and external services

- Drafts use `localStorage`; recent image history uses IndexedDB.
- Prompts and generation settings are sent directly to Pollinations. AI refinement also sends the prompt to that provider.
- Session access tokens stay in page memory rather than persistent browser storage.
- Fonts load from Google Fonts; inspiration photographs load from Unsplash.
- Browser storage is not a backup. Download images you want to keep.

See [`privacy.html`](privacy.html) for the full data-handling explanation and [`guide.html`](guide.html) for provider limits and troubleshooting.

## Author and acknowledgments

**Made by Andreas Agouridis.**

- AI services: [Pollinations](https://pollinations.ai)
- Inspiration photography: [Unsplash](https://unsplash.com)
- Typography: DM Sans and Manrope via [Google Fonts](https://fonts.google.com)

Forma is an independent interface. Third-party services and assets remain subject to their respective terms.
