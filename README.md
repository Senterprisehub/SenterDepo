# SR Apps Studio

SR Apps Studio is a web-based catalog for discovering Android APKs and Progressive Web Apps from the [Senterprisehub GitHub ecosystem](https://github.com/senterprisehub). The portal links to app pages and GitHub release downloads, and periodically refreshes its catalog from public repositories.

## Features

- Browse Android APKs and web apps in one catalog.
- Search by app name, description, repository, or topic.
- Filter by app type and category.
- View app details and installation guidance.
- Download APKs from GitHub Releases or open web apps.
- Cache catalog data in the browser and refresh it hourly, with a manual **Sync Now** option.

## Run locally

This project is a standalone HTML page and does not require a build step or package installation.

1. Clone or download this repository.
2. Open `index.html` in a modern web browser.

The page loads Tailwind CSS, fonts, and icons from external CDNs and fetches the public GitHub repository catalog at runtime, so those features require an internet connection.

## Deployment

The site can be hosted as a static page, for example with GitHub Pages. The page currently contains canonical and Open Graph URLs configured for `https://senterprisehub.github.io/hub/`; update those in `index.html` if deploying at a different address.

## Notes

The catalog includes a seed list for immediate display and supplements it with repositories discovered from the Senterprisehub GitHub account. Repository discovery uses GitHub's public API and is subject to its unauthenticated rate limits.

## License

See [LICENSE](LICENSE).
