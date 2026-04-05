# Strategy One (Metadata Scraper) Development Plan

This document outlines the 6-stage technical progression to implement the "Scraper Brain" for Information Mode. This pipeline will autonomously fetch, store, and display high-quality `og:image` thumbnails from breaking tech news articles.

## Stage 1: Data Layer Expansion
*   **Objective:** Modify the `ContentItem` schema to securely store external image URLs.
*   **Win Condition (Backend):** `npx prisma db push` executes successfully and a direct Prisma query shows the new `imageUrl` column.
*   **Win Condition (Frontend):** TypeScript stops emitting type errors when `imageUrl` is absent from existing payloads.

## Stage 2: HTML Parser Integration
*   **Objective:** Install a fast DOM parser to strip meta tags out of raw HTML bodies.
*   **Win Condition (Backend):** `pnpm add cheerio` resolves cleanly inside the `apps/feed-ingestor` workspace without breaking existing RSS dependencies.
*   **Win Condition (Frontend):** N/A (Internal dependency).

## Stage 3: The Headless Scraper Script
*   **Objective:** Build `fetchOgImage(url)` which fires an HTTP request spoofing a real browser (`User-Agent`), downloads the HTML, and extracts `<meta property="og:image">`.
*   **Win Condition (Backend):** We can run a localized test script against a known `https://netflixtechblog.com` article and it successfully `console.log()`s the raw JPEG/PNG link.
*   **Win Condition (Frontend):** N/A.

## Stage 4: Pipeline Injection
*   **Objective:** Wire the scraper directly into the RSS polling loop.
*   **Win Condition (Backend):** `feed-ingestor` completes a full polling cycle, deduplicates articles, and successfully logs saving `imageUrl` strings to the Postgres database.
*   **Win Condition (Frontend):** N/A.

## Stage 5: API Transport
*   **Objective:** Expose the stored image URLs to the React dashboard.
*   **Win Condition (Backend):** Hitting the `GET /api/signals` endpoint with curl or Postman returns JSON objects that natively include the `imageUrl` property.
*   **Win Condition (Frontend):** The React component effectively receives `imageUrl` in the `Signal` type mapping.

## Stage 6: The Visual UI Binding
*   **Objective:** Modify the Signal Cards to dynamically parse and render the image headers, cleanly falling back to minimal UI if no image exists.
*   **Win Condition (Backend):** N/A.
*   **Win Condition (Frontend):** You open `localhost:3000` and visually confirm slick, dark-themed image banners stretched across the top of tech news cards, and empty states remaining untampered.
