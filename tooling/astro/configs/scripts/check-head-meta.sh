#!/usr/bin/env bash
set -e
set -o pipefail

# Fails a built page missing a non-empty value for any of the six tags a link
# preview reads, catching a page that skipped `site-head.astro`. The canonical
# address is not judged, so a `.invalid` fallback stays visible in the page.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

DIST="$PROJECT_ROOT/dist"
PUBLIC="$PROJECT_ROOT/public"

# Callers run this after `bun run build`, so an absent dist means the build
# failed or never ran, which is no evidence any page carries its tags.
if [ ! -d "$DIST" ]; then
  echo "No $DIST. Run bun run build first." >&2
  exit 1
fi

# Each requirement is a tag name, an attribute pair that picks the tag out, and
# the attribute that must hold a value. Attribute order is free, since a hand
# written head orders them however its author did.
REQUIREMENTS=(
  "description|meta|name=\"description\"|content"
  "canonical|link|rel=\"canonical\"|href"
  "og:site_name|meta|property=\"og:site_name\"|content"
  "og:image|meta|property=\"og:image\"|content"
  "twitter:card|meta|name=\"twitter:card\"|content"
)

missing_in() {
  local file="$1" flat tags name element selector valued missing=()
  # One line per file, so a tag Astro or an author wrapped across lines still
  # matches as one.
  flat="$(tr '\n\r' '  ' <"$file")"

  if ! grep -qiE '<title[^>]*>[^<]*[^<[:space:]][^<]*</title>' <<<"$flat"; then
    missing+=("title")
  fi

  for requirement in "${REQUIREMENTS[@]}"; do
    IFS='|' read -r name element selector valued <<<"$requirement"
    tags="$(grep -oiE "<${element}[[:space:]][^>]*>" <<<"$flat" | grep -iF "$selector" || true)"
    if ! grep -qiE "[[:space:]]$valued=\"[^\"]+\"" <<<"$tags"; then
      missing+=("$name")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    local IFS=','
    echo "${missing[*]}"
  fi
}

pages=0
failures=0
while IFS= read -r -d '' file; do
  # Astro copies public/ into dist verbatim, so a file found there at the same
  # path is a static asset the project wrote, such as a verification file or
  # a standalone preview, rather than a page a layout rendered.
  if [ -f "$PUBLIC/${file#"$DIST"/}" ]; then
    continue
  fi
  pages=$((pages + 1))
  absent="$(missing_in "$file")"
  if [ -n "$absent" ]; then
    failures=$((failures + 1))
    echo "${file#"$DIST"/}: missing ${absent//,/, }" >&2
  fi
done < <(find "$DIST" -type f -name '*.html' -print0 | sort -z)

if [ "$pages" -eq 0 ]; then
  echo "No built page under $DIST, so no head was checked." >&2
  exit 1
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures of $pages built pages lack a head tag. Render src/components/site-head.astro in each page's head." >&2
  exit 1
fi

echo "check-head-meta: all $pages built pages carry the six head tags"
