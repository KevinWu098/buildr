#!/usr/bin/env python3
"""
Script to scrape and add socket information to CPU products using FireCrawl.
"""

import json
import os
import time
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from firecrawl import Firecrawl

# Load environment variables
load_dotenv()

# Configuration
JSON_FILE_PATH = Path(__file__).parent / "scraped_data" / "cpu_products.json"
BACKUP_FILE_PATH = Path(__file__).parent / "scraped_data" / "cpu_products_backup.json"
PROGRESS_FILE_PATH = Path(__file__).parent / "scraped_data" / "socket_scrape_progress.json"

# Rate limiting
DELAY_BETWEEN_REQUESTS = 1.5  # seconds


def load_products() -> Dict[str, Any]:
    """Load CPU products from JSON file."""
    with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_products(data: Dict[str, Any]) -> None:
    """Save CPU products to JSON file."""
    with open(JSON_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def save_progress(progress: Dict[str, Any]) -> None:
    """Save scraping progress."""
    with open(PROGRESS_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)


def load_progress() -> Dict[str, Any]:
    """Load scraping progress if exists."""
    if PROGRESS_FILE_PATH.exists():
        with open(PROGRESS_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"last_processed_index": -1, "successful": 0, "failed": 0, "failed_urls": []}


def scrape_socket(firecrawl: Firecrawl, url: str, product_name: str) -> str | None:
    """
    Scrape socket information from a product URL using FireCrawl.

    Args:
        firecrawl: FireCrawl instance
        url: Product URL to scrape
        product_name: Name of the product (for logging)

    Returns:
        Socket string if found, None otherwise
    """
    try:
        # Use FireCrawl JSON extraction to get the socket value
        result = firecrawl.scrape(
            url,
            formats=[{
                "type": "json",
                "prompt": "Extract the CPU socket type. Look for a 'Socket' specification in the product details. Return only the socket value (e.g., 'LGA1700', 'AM5', etc.)."
            }],
            timeout=30000
        )

        # Extract socket from the JSON result
        if result and hasattr(result, 'json') and result.json:
            json_data = result.json

            # Try different possible keys where socket might be stored
            socket_keys = ['socket', 'Socket', 'socket_type', 'cpu_socket']
            for key in socket_keys:
                if key in json_data and json_data[key]:
                    return str(json_data[key]).strip()

            # If it's a simple object with one value, return that
            if isinstance(json_data, dict) and len(json_data) == 1:
                return str(list(json_data.values())[0]).strip()

        print(f"  ⚠️  No socket found in response for {product_name}")
        return None

    except Exception as e:
        print(f"  ❌ Error scraping {product_name}: {str(e)}")
        return None


def main():
    """Main function to scrape and add socket information to all CPU products."""

    # Check for API key
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        print("❌ Error: FIRECRAWL_API_KEY not found in environment variables.")
        print("Please set it in a .env file or as an environment variable.")
        return

    # Initialize FireCrawl
    print("🔥 Initializing FireCrawl...")
    firecrawl = Firecrawl(api_key=api_key)

    # Load existing data
    print(f"📁 Loading products from {JSON_FILE_PATH}...")
    data = load_products()
    products = data.get("products", [])
    total_products = len(products)

    print(f"📊 Found {total_products} products to process")

    # Create backup
    print(f"💾 Creating backup at {BACKUP_FILE_PATH}...")
    with open(BACKUP_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Load progress
    progress = load_progress()
    start_index = progress["last_processed_index"] + 1

    if start_index > 0:
        print(f"📂 Resuming from product #{start_index + 1}")

    # Process each product
    print(f"\n🚀 Starting socket scraping...\n")

    for i in range(start_index, total_products):
        product = products[i]
        product_name = product.get("name", "Unknown")
        product_url = product.get("url", "")

        # Skip if socket already exists
        if "socket" in product and product["socket"]:
            print(f"[{i + 1}/{total_products}] ⏭️  Skipping {product_name} (socket already exists: {product['socket']})")
            progress["last_processed_index"] = i
            continue

        print(f"[{i + 1}/{total_products}] 🔍 Scraping {product_name}...")
        print(f"  URL: {product_url}")

        # Scrape socket
        socket = scrape_socket(firecrawl, product_url, product_name)

        if socket:
            product["socket"] = socket
            progress["successful"] += 1
            print(f"  ✅ Socket found: {socket}")
        else:
            product["socket"] = None
            progress["failed"] += 1
            progress["failed_urls"].append({
                "index": i,
                "name": product_name,
                "url": product_url
            })
            print(f"  ⚠️  Socket not found")

        # Update progress
        progress["last_processed_index"] = i

        # Save progress every 10 products
        if (i + 1) % 10 == 0:
            print(f"\n💾 Saving progress... (Successful: {progress['successful']}, Failed: {progress['failed']})")
            save_products(data)
            save_progress(progress)
            print()

        # Rate limiting
        if i < total_products - 1:  # Don't delay after the last product
            time.sleep(DELAY_BETWEEN_REQUESTS)

    # Final save
    print(f"\n💾 Saving final results...")
    save_products(data)
    save_progress(progress)

    # Summary
    print(f"\n{'='*60}")
    print(f"✨ Scraping Complete!")
    print(f"{'='*60}")
    print(f"Total products processed: {total_products}")
    print(f"✅ Successful: {progress['successful']}")
    print(f"❌ Failed: {progress['failed']}")

    if progress['failed'] > 0:
        print(f"\n⚠️  Failed URLs saved to: {PROGRESS_FILE_PATH}")
        print(f"You can review and retry these manually.")

    print(f"\n📁 Updated data saved to: {JSON_FILE_PATH}")
    print(f"📁 Backup saved to: {BACKUP_FILE_PATH}")


if __name__ == "__main__":
    main()
