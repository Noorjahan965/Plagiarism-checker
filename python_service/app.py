from flask import Flask, request, jsonify
import requests as http_requests
from plagiarism_core import check_against_sources

app = Flask(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

def get_dynamic_sources(text: str, num_sources: int = 6) -> list:
    """Search Wikipedia for articles relevant to the input text."""
    query = text[:120].strip()
    try:
        search_url = (
            "https://en.wikipedia.org/w/api.php"
            f"?action=query&list=search"
            f"&srsearch={http_requests.utils.quote(query)}"
            f"&srlimit={num_sources}&format=json"
        )
        resp = http_requests.get(search_url, headers=HEADERS, timeout=8)
        resp.raise_for_status()
        results = resp.json().get("query", {}).get("search", [])
        urls = [
            "https://en.wikipedia.org/wiki/" + r["title"].replace(" ", "_")
            for r in results
        ]
        print(f"[INFO] Dynamic sources found: {urls}")
        return urls if urls else _fallback_sources()
    except Exception as e:
        print(f"[WARN] Dynamic search failed: {e}, using fallback sources")
        return _fallback_sources()


def _fallback_sources() -> list:
    """Broad topic coverage used when dynamic search fails."""
    return [
        # Animals & Nature
        "https://en.wikipedia.org/wiki/Cat",
        "https://en.wikipedia.org/wiki/Dog",
        "https://en.wikipedia.org/wiki/Mammal",
        "https://en.wikipedia.org/wiki/Animal",
        "https://en.wikipedia.org/wiki/Biology",
        "https://en.wikipedia.org/wiki/Evolution",
        # Sciences
        "https://en.wikipedia.org/wiki/Science",
        "https://en.wikipedia.org/wiki/Physics",
        "https://en.wikipedia.org/wiki/Chemistry",
        "https://en.wikipedia.org/wiki/Mathematics",
        "https://en.wikipedia.org/wiki/Medicine",
        # Technology
        "https://en.wikipedia.org/wiki/Artificial_intelligence",
        "https://en.wikipedia.org/wiki/Machine_learning",
        "https://en.wikipedia.org/wiki/Computer_science",
        "https://en.wikipedia.org/wiki/Internet",
        # History & Society
        "https://en.wikipedia.org/wiki/History",
        "https://en.wikipedia.org/wiki/Philosophy",
        "https://en.wikipedia.org/wiki/Economics",
        "https://en.wikipedia.org/wiki/Psychology",
        # Arts & Literature
        "https://en.wikipedia.org/wiki/Literature",
        "https://en.wikipedia.org/wiki/Art",
        "https://en.wikipedia.org/wiki/Music",
    ]


@app.route("/check", methods=["POST"])
def check():
    body = request.get_json(silent=True)

    if not body or "text" not in body:
        return jsonify({"error": "Request body must contain a 'text' field."}), 400

    input_text = body.get("text", "").strip()
    if not input_text:
        return jsonify({"error": "'text' field must not be empty."}), 400

    sources = body.get("sources") or get_dynamic_sources(input_text)
    result  = check_against_sources(input_text, sources)

    response = {
        "input_text":       input_text[:200],
        "plagiarism_score": result["total_score"],
        "total_score":      result["total_score"],
        "verdict":          result["verdict"],
        "results": [
            {
                "url":    s["url"],
                "score":  s["score"],
                "status": s["status"]
            }
            for s in result["sources"]
        ],
    }
    return jsonify(response), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)