# Heritage Website Visits 1.0.0

This release adds cookieless Website Visits to the exact public host
`heritagevacations.com` and ten explicit public sitemap paths. It does not lift
legacy GA4, ads, Page Actions, RUM, identity, or replay restrictions.

The portal and preview hosts keep their original shells. The rental search,
property/booking flow, contact forms, management, owner, and account paths are
not included. The loader additionally suppresses GPC, sensitive queries,
automation, prerendering, and background documents. It runs only after first
contentful paint, two animation frames, and idle. The collector enforces the
same exact path allowlist on subsequent SPA navigation.

## Preserved production baseline

Current deployment: `dpl_7wLE8NnuxkLL8KAr5PBDYVfM3u8S`.
Current main app: `/assets/index-KbtTV3wP.js`, SHA-256
`d544a9450628cbb9149fa0df0cd59b57508eab75a5eaf36e6eec1889de608056`.

Six existing deployed source corrections are persisted unchanged in this PR:
Heritage's intentionally hidden Buy links and its portal host isolation. They
were ahead of the Git default branch. They are not newly enabled behavior.

The exact prior 557 uncompressed artifact SHA-1 values and 750 deployment
routes are stored with the release evidence under
`/work/data/hht-owner-card-search-2026-11-16/`. Every raw artifact was verified.
The app bundle is not rebuilt or replaced for this release. A baseline source
build was tested, but is not the published artifact.

## Reproduce this narrow release

1. Run `bun test src/lib/websiteVisits.test.ts`.
2. Build the standalone loader:
   `bun build scripts/heritage-visits.ts --target browser --format iife --minify --outfile public/website-visits-heritage-v1.js`.
3. Copy the verified current 557-file raw artifact set to a separate release
   directory. Add the compiled public loader there.
4. Run `scripts/website_visits_heritage_release.py` with `--dist`,
   `--baseline-request`, `--expected-hashes`, and `--output` referring to the
   saved current deployment evidence. It verifies all prior bytes, creates a
   dedicated public shell, and adds exactly one exact-host public-path route
   before the original host-shell routes. All prior routes remain unchanged.
5. Upload standard raw files using the manifest-first/missing-files workflow,
   with empty build/install commands. Do not reuse historical compression
   transport. Preserve the generated route array exactly.
6. Verify custom-domain artifacts, private/portal exclusions, GPC, empty
   collector Cookie/Referer, and positive stored host-scoped aggregate deltas
   from genuine browser observations before recording activation.

Collection also requires the exact host in the existing Club Group Visits
config; add it additively without rotating the shared key. The WordPress
siblings use that same config. Never disable it to roll back Heritage alone:
restore the previous Vercel deployment or remove this one public route and
shell instead. No backend, payment, DNS, WAF, or security setting changes.
