"""
plagiarism_core.py
==================
Core NLP engine for the Plagiarism Checker.

Fixes applied vs. the original:
  1. Score math    — cosine similarity is already 0-1; we multiply by 100 once,
                     never sum raw scores across sources.
  2. N-gram TF-IDF — trigrams (1,3) catch phrase-level matches, not just words.
  3. Lemmatization — WordNetLemmatizer collapses inflected forms (run/running/ran).
  4. User-Agent    — Wikipedia (and most sites) require a real UA header; added.
  5. Clean output  — every public function returns plain Python dicts/floats that
                     Flask jsonify() can serialise without surprises.

Dependencies (install once):
    pip install flask requests nltk scikit-learn
    python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords');
               nltk.download('wordnet'); nltk.download('omw-1.4')"
"""

import re
import logging
import requests

import nltk
for _pkg in ["punkt", "stopwords", "wordnet", "omw-1.4", "averaged_perceptron_tagger_eng", "punkt_tab"]:
    nltk.download(_pkg, quiet=True)
from nltk.corpus   import stopwords, wordnet
from nltk.stem     import WordNetLemmatizer
from nltk.tokenize import word_tokenize

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise         import cosine_similarity

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

# ── NLTK data (downloaded once, silently skipped if already present) ───────────
for _pkg in ("punkt", "stopwords", "wordnet", "omw-1.4", "averaged_perceptron_tagger"):
    try:
        nltk.download(_pkg, quiet=True)
    except Exception:
        pass

# ── Constants ──────────────────────────────────────────────────────────────────
STOP_WORDS  = set(stopwords.words("english"))
LEMMATIZER  = WordNetLemmatizer()

# Realistic browser User-Agent — Wikipedia blocks the default `python-requests/x`
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 10   # seconds per HTTP call
MAX_SOURCE_TEXT = 8_000  # chars — enough for a solid TF-IDF without being slow


# ══════════════════════════════════════════════════════════════════════════════
# 1. TEXT PRE-PROCESSING
# ══════════════════════════════════════════════════════════════════════════════

def _get_wordnet_pos(treebank_tag: str):
    """Map a Penn Treebank POS tag to a WordNet POS constant."""
    if treebank_tag.startswith("J"):
        return wordnet.ADJ
    if treebank_tag.startswith("V"):
        return wordnet.VERB
    if treebank_tag.startswith("R"):
        return wordnet.ADV
    return wordnet.NOUN   # default


def preprocess(text: str) -> str:
    """
    Clean and normalise text:
      • lower-case
      • remove URLs, punctuation, digits
      • tokenise
      • remove stop-words
      • lemmatise with POS awareness (run/runs/running → run)

    Returns a single normalised string suitable for TF-IDF.
    """
    if not text or not text.strip():
        return ""

    # Lower-case + strip URLs
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)

    # Keep only letters and spaces
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Tokenise
    tokens = word_tokenize(text)

    # POS-tag for accurate lemmatisation
    tagged = nltk.pos_tag(tokens)

    # Lemmatise + remove stop-words and single-character tokens
    clean_tokens = [
        LEMMATIZER.lemmatize(word, _get_wordnet_pos(tag))
        for word, tag in tagged
        if word not in STOP_WORDS and len(word) > 1
    ]

    return " ".join(clean_tokens)


# ══════════════════════════════════════════════════════════════════════════════
# 2. SIMILARITY ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def compute_similarity(text_a: str, text_b: str) -> float:
    processed_a = preprocess(text_a)
    processed_b = preprocess(text_b)

    if not processed_a or not processed_b:
        return 0.0

    try:
        vectorizer   = TfidfVectorizer(ngram_range=(1, 3), min_df=1)
        tfidf_matrix = vectorizer.fit_transform([processed_a, processed_b])
        score        = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]
        score        = max(0.0, min(1.0, float(score)))  # clamp to 0-1

        percentage = round(score * 100, 2)   # ← convert to 0-100 HERE
        print(f"[DEBUG] raw={score:.4f}  percentage={percentage}")
        return percentage                     # ← always returns 0-100

    except Exception as exc:
        log.warning("TF-IDF failed: %s", exc)
        return 0.0

# ══════════════════════════════════════════════════════════════════════════════
# 3. WEB SCRAPER  (Wikipedia + generic fallback)
# ══════════════════════════════════════════════════════════════════════════════

def _fetch_wikipedia_text(url: str) -> str:
    """
    Fetch plain text from a Wikipedia article via the MediaWiki API.
    Falls back to raw HTML scraping if the API path is not detected.
    Using the API avoids parsing boilerplate (navbars, footers, etc.)
    """
    # Detect Wikipedia and use the ?action=query API for clean plain-text
    wiki_match = re.search(
        r"wikipedia\.org/wiki/(.+)", url, re.IGNORECASE
    )
    if wiki_match:
        title = wiki_match.group(1)
        api_url = (
            "https://en.wikipedia.org/w/api.php"
            f"?action=query&titles={title}&prop=extracts"
            "&explaintext=true&format=json&redirects=1"
        )
        try:
            resp = requests.get(api_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data  = resp.json()
            pages = data.get("query", {}).get("pages", {})
            # The API returns a dict keyed by page-id (even if there is only one)
            page_text = next(iter(pages.values()), {}).get("extract", "")
            return page_text[:MAX_SOURCE_TEXT]
        except Exception as exc:
            log.warning("Wikipedia API failed for '%s': %s", title, exc)

    # Generic fallback — plain GET with real headers
    return _fetch_generic_text(url)


def _fetch_generic_text(url: str) -> str:
    """Fetch raw HTML and strip tags to get approximate plain text."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text

        # Very lightweight tag stripping (no BeautifulSoup dependency)
        text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S)
        text = re.sub(r"<style[^>]*>.*?</style>",  " ", text,  flags=re.S)
        text = re.sub(r"<[^>]+>",                  " ", text)
        text = re.sub(r"&[a-z]+;",                 " ", text)  # HTML entities
        text = re.sub(r"\s+",                       " ", text).strip()

        return text[:MAX_SOURCE_TEXT]
    except requests.exceptions.Timeout:
        log.warning("Timeout fetching: %s", url)
    except requests.exceptions.RequestException as exc:
        log.warning("Request error for '%s': %s", url, exc)
    return ""


def fetch_source_text(url: str) -> str:
    """
    Public dispatcher: routes to the Wikipedia API or generic scraper.
    Always returns a string (empty string on failure — never raises).
    """
    url = url.strip()
    if not url:
        return ""
    if "wikipedia.org" in url.lower():
        return _fetch_wikipedia_text(url)
    return _fetch_generic_text(url)


# ══════════════════════════════════════════════════════════════════════════════
# 4. AGGREGATE SCORER
# ══════════════════════════════════════════════════════════════════════════════

def check_against_sources(input_text: str, source_urls: list) -> dict:
    """
    Compare `input_text` against every URL in `source_urls`.

    Score logic (THE KEY FIX):
      • Each source produces an independent similarity score (0–100).
      • total_score = MAX of all per-source scores (not a sum, not an average).
        Using the maximum makes intuitive sense: "how similar is this text
        to the most similar source we found?"

    Returns a dict shaped exactly how the Express backend expects:
    {
        "total_score": 42.75,          # float, 0-100, max across all sources
        "verdict":     "moderate",     # "original" | "low" | "moderate" | "high"
        "sources": [
            {
                "url":   "https://...",
                "score": 42.75,        # float, 0-100
                "status": "ok"         # "ok" | "empty" | "error"
            },
            ...
        ]
    }
    """
    if not input_text or not input_text.strip():
        return _empty_result("No input text provided.", source_urls)

    results = []

    for url in source_urls:
        log.info("Fetching: %s", url)
        source_text = fetch_source_text(url)

        if not source_text.strip():
            log.warning("Empty content from: %s", url)
            results.append({"url": url, "score": 0.0, "status": "empty"})
            continue

        score = compute_similarity(input_text, source_text)
        log.info("Score for %s → %.2f%%", url, score)
        results.append({"url": url, "score": score, "status": "ok"})

    if not results:
        return _empty_result("No sources could be fetched.", source_urls)

    # ── THE FIX: use max(), not sum() ─────────────────────────────────────────
    all_scores   = [r["score"] for r in results]
    total_score  = round(max(all_scores), 2)   # highest individual match

    return {
        "total_score": total_score,
        "verdict":     _verdict(total_score),
        "sources":     sorted(results, key=lambda r: r["score"], reverse=True),
    }


def _verdict(score: float) -> str:
    """Human-readable verdict tier matching the frontend colour scheme."""
    if score < 10:
        return "original"
    if score < 30:
        return "low"
    if score < 60:
        return "moderate"
    return "high"


def _empty_result(reason: str, urls: list) -> dict:
    return {
        "total_score": 0.0,
        "verdict":     "original",
        "sources":     [{"url": u, "score": 0.0, "status": "error"} for u in urls],
        "error":       reason,
    }