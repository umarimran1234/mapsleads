# Maps Leads

Local lead generation dashboard. Pick a business type and an area, collect businesses from Google Maps, find emails and social profiles from their websites, and manage everything in one place.

Everything runs on your own computer.

<!-- Add a screenshot or GIF here, e.g. the Leads table -->
<!-- ![Maps Leads dashboard](docs/leads.png) -->

## Features

- **Deep search**: splits a whole area into tiles, scans each one, then visits every business website to find emails and social profiles.
- **Quick scrape**: one or more keywords for a single city.
- **Email finder**: paste a list of websites and get their public emails and social links.
- **Jobs**: every scrape in one list with live progress.
- **Leads**: search, filters (has email, has phone, source job), status tracking, notes and bulk actions.
- **Import / Export**: CSV and JSON.
- **Dashboard**: stats and charts.
- **Settings**: engine status and data management.
- **Theme**: light and dark mode.

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) (LTS)
- [Git](https://git-scm.com/)

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd <repo-folder>

# 2. Start the engine
docker compose up -d

# 3. Start the app
cd app
npm install
npm run dev
```

Then open **http://127.0.0.1:3000** in your browser.

To stop everything: press `Ctrl + C` in the terminal running the app, then run `docker compose down` in the project root.

## How to use

1. Open **Quick scrape** (fast, one city) or **Deep search** (whole area).
2. Enter a business type (for example `hair salons`) and a city or area (for example `London`).
3. Turn on **Find emails** if you want emails and socials collected from each website.
4. Click **Start scrape** and watch progress in **Jobs**.
5. Open **Leads** to search, filter (for example *Has email*), set a status, add notes and export to CSV or JSON.
6. Have a list of websites already? Use **Email finder** and paste them in.

## Troubleshooting

- **Page does not open:** check that `npm run dev` is still running and use `127.0.0.1:3000`.
- **Engine offline in the sidebar:** make sure Docker Desktop is running, then run `docker compose up -d` again.
- **`docker` command not found:** install Docker Desktop and restart the terminal.
- **Port already in use:** close the other app using port 3000, or stop and restart the dev server.
- **Few or no emails found:** many businesses do not publish an email. The tool only finds addresses a site publishes.

## Responsible use

This tool collects publicly listed business information. You are responsible for how you use it:

- Follow the terms of the services you collect data from, including Google Maps.
- Follow the laws that apply to your outreach, such as GDPR, UK PECR and CAN-SPAM.
- Business emails can still be personal data. Only contact people where you have a lawful basis, identify yourself, and always offer an easy opt-out.
- Scrape at a reasonable pace and do not use the tool for spam.

## Contributing

Bug reports and feature requests are welcome as issues.

## License

Copyright (c) 2026 umar.

Licensed under the [PolyForm Internal Use License 1.0.0](LICENSE). You may use and modify this software for the internal operations of you and your company. You may not distribute it, resell it, or offer it as a service to others.
