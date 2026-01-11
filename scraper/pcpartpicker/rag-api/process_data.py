"""Process scraped PC part data for RAG knowledge base.

This script:
1. Reads all product JSON files from the scraped_data directory
2. Removes url, image_url, and rating fields
3. Replaces ###### placeholder values with None
4. Outputs cleaned data to processed_data subdirectory
"""

import json
import re
from pathlib import Path

# Paths
SCRAPED_DATA_DIR = Path(__file__).parent.parent / 'scraper' / 'scraped_data'
PROCESSED_DATA_DIR = Path(__file__).parent / 'processed_data'

# Pattern to match placeholder values like "######" or "###### Some Text"
PLACEHOLDER_PATTERN = re.compile(r'^#{6}.*$')


def clean_value(value: str | None) -> str | None:
    """Clean a single value, replacing placeholder patterns with None."""
    if value is None:
        return None
    if isinstance(value, str) and PLACEHOLDER_PATTERN.match(value.strip()):
        return None
    return value


def clean_product(product: dict, fields_to_remove: set[str]) -> dict:
    """Clean a single product record.

    Args:
        product: The product dictionary to clean
        fields_to_remove: Set of field names to remove (url, image_url, rating)

    Returns:
        Cleaned product dictionary
    """
    cleaned = {}
    for key, value in product.items():
        # Skip fields we want to remove
        if key in fields_to_remove:
            continue
        # Clean the value (replace ###### placeholders)
        cleaned[key] = clean_value(value)
    return cleaned


def process_json_file(input_path: Path, output_path: Path) -> int:
    """Process a single JSON file.

    Args:
        input_path: Path to the input JSON file
        output_path: Path to write the cleaned JSON file

    Returns:
        Number of products processed
    """
    with open(input_path, encoding='utf-8') as f:
        data = json.load(f)

    # Fields to remove from each product
    fields_to_remove = {'url', 'image_url', 'rating'}

    # Clean each product
    cleaned_products = []
    for product in data.get('products', []):
        cleaned = clean_product(product, fields_to_remove)
        cleaned_products.append(cleaned)

    # Build output data structure
    output_data = {
        'category': data.get('category'),
        'product_count': len(cleaned_products),
        'products': cleaned_products,
    }

    # Write cleaned data
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    return len(cleaned_products)


def main():
    """Process all scraped JSON files."""
    # Ensure output directory exists
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Find all JSON files in scraped_data directory
    json_files = list(SCRAPED_DATA_DIR.glob('*_products.json'))

    if not json_files:
        print(f'No JSON files found in {SCRAPED_DATA_DIR}')
        return

    print(f'Found {len(json_files)} JSON files to process')
    print(f'Output directory: {PROCESSED_DATA_DIR}')
    print('-' * 50)

    total_products = 0
    for input_path in json_files:
        output_path = PROCESSED_DATA_DIR / input_path.name
        count = process_json_file(input_path, output_path)
        total_products += count
        print(f'Processed {input_path.name}: {count} products')

    print('-' * 50)
    print(f'Total: {total_products} products processed')
    print(f'Output written to: {PROCESSED_DATA_DIR}')


if __name__ == '__main__':
    main()
