import json
import os
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from scrape_all_categories import parse_cpu_table, scrape_category

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Initialize Firecrawl
    api_key = os.getenv('FIRECRAWL_API_KEY')
    if not api_key:
        raise ValueError("FIRECRAWL_API_KEY not found in .env file")

    app = FirecrawlApp(api_key=api_key)

    # Test with CPU category, limiting to 50 products for quick testing
    print("Testing CPU category scraper (50 products)...")
    result = scrape_category(app, "CPU", "/products/cpu/", parse_cpu_table, max_products=50)

    print("\n" + "="*80)
    print("TEST SUCCESSFUL")
    print("="*80)
    print(f"Products scraped: {result['product_count']}")
    print(f"File saved: cpu_products.json")
    print("\nIf this looks good, run scrape_all_categories.py to scrape all categories!")
