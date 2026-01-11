import json
from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

from models import CATEGORY_MODEL_MAP

# Paths
SCRAPED_DATA_DIR = Path(__file__).parent.parent / "scraper" / "scraped_data"
OUTPUT_DB = Path(__file__).parent / "pcpartpicker.db"


def get_model_field_names(model_class: type[SQLModel]) -> set[str]:
    """Get all field names from a SQLModel class."""
    return set(model_class.model_fields.keys())


def main():
    # Ensure output directory exists
    OUTPUT_DB.parent.mkdir(parents=True, exist_ok=True)

    # Remove existing database if it exists
    if OUTPUT_DB.exists():
        OUTPUT_DB.unlink()
        print(f"Removed existing database: {OUTPUT_DB}")

    # Create SQLModel engine
    engine = create_engine(f"sqlite:///{OUTPUT_DB}", echo=False)

    # Create all tables from SQLModel metadata
    SQLModel.metadata.create_all(engine)
    print(f"Created database: {OUTPUT_DB}")

    # Process each JSON file
    json_files = sorted(SCRAPED_DATA_DIR.glob("*.json"))

    with Session(engine) as session:
        for json_file in json_files:
            print(f"\nProcessing {json_file.name}...")

            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            category = data.get("category")
            products = data.get("products", [])

            if not category or not products:
                print(f"  Skipping {json_file.name}: No category or products found")
                continue

            # Get the model class for this category
            model_class = CATEGORY_MODEL_MAP.get(category)
            if not model_class:
                print(f"  Skipping {json_file.name}: No model found for category '{category}'")
                continue

            # Get valid field names for this model
            valid_fields = get_model_field_names(model_class)

            # Insert products
            inserted_count = 0
            for product in products:
                # Filter product data to only include valid fields
                # and convert rating to int if present
                filtered_data = {}
                for key, value in product.items():
                    if key in valid_fields:
                        if key == "rating" and value is not None:
                            try:
                                value = int(value)
                            except (ValueError, TypeError):
                                value = None
                        filtered_data[key] = value

                # Create model instance and add to session
                model_instance = model_class(**filtered_data)
                session.add(model_instance)
                inserted_count += 1

            session.commit()
            print(f"  Created table '{category}' and inserted {inserted_count} products")

    print(f"\nDatabase created successfully at {OUTPUT_DB}")
    print(f"Total categories processed: {len(json_files)}")


if __name__ == "__main__":
    main()
