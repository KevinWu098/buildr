"""Process CPU data to extract only relevant fields for RAG."""

import json
from pathlib import Path


def process_cpu_data(input_path: str, output_path: str) -> None:
    """Extract name, price, and integrated_graphics from CPU data."""
    with open(input_path, "r") as f:
        data = json.load(f)

    processed = []
    for product in data["products"]:
        processed.append({
            "name": product["name"],
            "price": product.get("price"),
            "integrated_graphics": product.get("integrated_graphics"),
        })

    with open(output_path, "w") as f:
        json.dump(processed, f, indent=2)

    print(f"Processed {len(processed)} CPUs to {output_path}")


if __name__ == "__main__":
    input_file = Path(__file__).parent.parent / "scraper" / "scraped_data" / "cpu_products.json"
    output_file = Path(__file__).parent / "cpu_knowledge_base.json"
    process_cpu_data(str(input_file), str(output_file))
