"""
One-time model download script.
Called by start.bat on first run. Creates .model_ready flag when done.
"""
import sys
import os
from pathlib import Path

def main():
    repo_root = Path(__file__).parent.resolve()
    cache_dir = repo_root / "model_cache"
    flag_file = repo_root / ".model_ready"

    if flag_file.exists():
        print("[OK] Model already cached - skipping download.")
        return 0

    print("")
    print("  Downloading AI model (MedCPT, ~440 MB) - first time only...")
    print("  Please keep this window open and stay connected to the internet.")
    print("")

    try:
        cache_dir.mkdir(exist_ok=True)
        os.environ["TRANSFORMERS_CACHE"] = str(cache_dir)
        os.environ["HF_HOME"] = str(cache_dir)

        from transformers import AutoTokenizer, AutoModel
        print("  Downloading tokenizer...")
        AutoTokenizer.from_pretrained("ncbi/MedCPT-Query-Encoder", cache_dir=str(cache_dir))
        print("  Downloading model weights...")
        AutoModel.from_pretrained("ncbi/MedCPT-Query-Encoder", cache_dir=str(cache_dir))
        flag_file.touch()
        print("")
        print("[OK] Model downloaded and cached. Will not download again.")
        return 0
    except Exception as e:
        print(f"")
        print(f"[WARN] Could not download model: {e}")
        print(f"       App will run in keyword-search mode (BM25 only).")
        print(f"       To enable full AI search, connect to internet and rerun start.bat.")
        return 0   # return 0 so start.bat still continues

if __name__ == "__main__":
    sys.exit(main())
