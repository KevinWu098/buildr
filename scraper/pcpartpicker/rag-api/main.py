"""RAG API for PC parts queries - supports CPUs, GPUs, motherboards, memory, storage, cases, coolers, and PSUs."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import lancedb  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

AZURE_OPENAI_BASE_URL = os.getenv('AZURE_OPENAI_BASE_URL')
AZURE_OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY')
AZURE_OPENAI_MODEL = os.getenv('AZURE_OPENAI_MODEL')
AZURE_OPENAI_EMBEDDING_MODEL = os.getenv('AZURE_OPENAI_EMBEDDING_MODEL')

client = OpenAI(
    base_url=AZURE_OPENAI_BASE_URL,
    api_key=AZURE_OPENAI_API_KEY,
)

# Paths
PROCESSED_DATA_DIR = Path(__file__).parent / 'processed_data'
DB_PATH = Path(__file__).parent / 'vectordb'

# Category configurations with their display names and relevant attributes
CATEGORY_CONFIG = {
    'cpu': {
        'file': 'cpu_products.json',
        'display_name': 'CPU',
        'search_text_fields': ['name', 'microarchitecture'],
    },
    'video_card': {
        'file': 'video_card_products.json',
        'display_name': 'Video Card',
        'search_text_fields': ['name', 'chipset'],
    },
    'motherboard': {
        'file': 'motherboard_products.json',
        'display_name': 'Motherboard',
        'search_text_fields': ['name', 'socket_cpu', 'form_factor'],
    },
    'memory': {
        'file': 'memory_products.json',
        'display_name': 'Memory',
        'search_text_fields': ['name', 'speed'],
    },
    'storage': {
        'file': 'storage_products.json',
        'display_name': 'Storage',
        'search_text_fields': ['name', 'type', 'form_factor'],
    },
    'case': {
        'file': 'case_products.json',
        'display_name': 'Case',
        'search_text_fields': ['name', 'type'],
    },
    'cpu_cooler': {
        'file': 'cpu_cooler_products.json',
        'display_name': 'CPU Cooler',
        'search_text_fields': ['name'],
    },
    'power_supply': {
        'file': 'power_supply_products.json',
        'display_name': 'Power Supply',
        'search_text_fields': ['name', 'efficiency_rating', 'wattage'],
    },
}

# LanceDB connection (initialized on startup)
db = None
tables: dict[str, Any] = {}


def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(input=text, model=AZURE_OPENAI_EMBEDDING_MODEL)
    return response.data[0].embedding


def build_search_text(product: dict, fields: list[str]) -> str:
    """Build a search text string from specified product fields."""
    parts = []
    for field in fields:
        value = product.get(field)
        if value:
            parts.append(str(value))
    return ' '.join(parts)


def format_product_info(product: dict, category: str) -> str:
    """Format product information for display."""
    display_name = CATEGORY_CONFIG[category]['display_name']
    lines = [f'{display_name} Information:']

    for key, value in product.items():
        if key in ('vector', 'search_text'):
            continue
        # Format the key nicely
        formatted_key = key.replace('_', ' ').title()
        display_value = value if value is not None else 'Not available'
        lines.append(f'- {formatted_key}: {display_value}')

    return '\n'.join(lines)


def init_category_table(category: str, config: dict) -> int:
    """Initialize a LanceDB table for a specific category."""
    global db, tables

    table_name = f'{category}_products'

    # Check if table already exists
    if table_name in db.table_names():
        tables[category] = db.open_table(table_name)
        count = tables[category].count_rows()
        print(f'  Loaded existing table {table_name} with {count} products')
        return count

    # Load and process data
    data_file = PROCESSED_DATA_DIR / config['file']
    if not data_file.exists():
        print(f'  Warning: {data_file} not found, skipping {category}')
        return 0

    with open(data_file, encoding='utf-8') as f:
        data = json.load(f)

    products = data.get('products', [])
    if not products:
        print(f'  Warning: No products found in {data_file}')
        return 0

    print(f'  Computing embeddings for {len(products)} {category} products...')

    records = []
    for product in products:
        # Build search text from configured fields
        search_text = build_search_text(product, config['search_text_fields'])
        if not search_text:
            search_text = product.get('name', 'Unknown')

        embedding = get_embedding(search_text)

        record = {**product, 'vector': embedding, 'search_text': search_text}
        records.append(record)

    tables[category] = db.create_table(table_name, records)
    print(f'  Created table {table_name} with {len(records)} products')
    return len(records)


def init_vectordb():
    """Initialize LanceDB with all product categories."""
    global db, tables

    db = lancedb.connect(str(DB_PATH))

    print('Initializing vector database...')
    total_products = 0

    for category, config in CATEGORY_CONFIG.items():
        print(f'Processing {category}...')
        count = init_category_table(category, config)
        total_products += count

    print(f'\nTotal: {total_products} products loaded across {len(tables)} categories')


def find_relevant_product(
    query: str, category: str | None = None
) -> tuple[dict | None, str | None]:
    """Find the most relevant product using vector similarity search.

    Args:
        query: The search query
        category: Optional category to search in. If None, searches all categories.

    Returns:
        Tuple of (product dict, category name) or (None, None) if not found
    """
    query_embedding = get_embedding(query)

    best_result = None
    best_category = None
    best_distance = float('inf')

    # Determine which categories to search
    categories_to_search = [category] if category else list(tables.keys())

    for cat in categories_to_search:
        if cat not in tables:
            continue

        results = tables[cat].search(query_embedding).limit(1).to_list()

        if results:
            result = results[0]
            distance = result.get('_distance', float('inf'))
            if distance < best_distance:
                best_distance = distance
                best_result = result
                best_category = cat

    if best_result is None:
        return None, None

    # Remove internal fields from result
    product = {
        k: v
        for k, v in best_result.items()
        if k not in ('vector', 'search_text', '_distance')
    }
    return product, best_category


def generate_response(query: str, product: dict, category: str) -> str:
    """Generate a natural language response using the product data."""
    context = format_product_info(product, category)

    response = client.chat.completions.create(
        model=AZURE_OPENAI_MODEL,
        messages=[
            {
                'role': 'system',
                'content': """You answer questions about PC parts based on the provided data. Be concise and direct.
You can answer questions about any attributes present in the data.
If a value shows "Not available", acknowledge that the information is not in the database.
Only use information from the provided context.""",
            },
            {'role': 'user', 'content': f'Context:\n{context}\n\nQuestion: {query}'},
        ],
    )
    return response.choices[0].message.content or ''


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_vectordb()
    yield


app = FastAPI(
    title='PC Parts RAG API',
    description='Query PC parts knowledge base with natural language',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str
    category: str | None = None


class QueryResponse(BaseModel):
    answer: str
    matched_product: str
    category: str


class SearchRequest(BaseModel):
    query: str
    category: str | None = None
    limit: int = 5


class ProductResult(BaseModel):
    name: str
    category: str
    attributes: dict


class SearchResponse(BaseModel):
    results: list[ProductResult]


@app.post('/query', response_model=QueryResponse)
async def query_product(request: QueryRequest):
    """Query the PC parts knowledge base with a natural language question.

    Optionally specify a category to narrow the search:
    - cpu, video_card, motherboard, memory, storage, case, cpu_cooler, power_supply
    """
    product, category = find_relevant_product(request.query, request.category)

    if not product or not category:
        return QueryResponse(
            answer='No matching product found.',
            matched_product='',
            category='',
        )

    answer = generate_response(request.query, product, category)
    return QueryResponse(
        answer=answer,
        matched_product=product.get('name', 'Unknown'),
        category=category,
    )


@app.post('/search', response_model=SearchResponse)
async def search_products(request: SearchRequest):
    """Search for products by similarity without generating a response.

    Returns the top maxtching products with their attributes.
    """
    query_embedding = get_embedding(request.query)

    all_results = []
    categories_to_search = (
        [request.category] if request.category else list(tables.keys())
    )

    for cat in categories_to_search:
        if cat not in tables:
            continue

        results = tables[cat].search(query_embedding).limit(request.limit).to_list()

        for result in results:
            # Remove internal fields
            attributes = {
                k: v
                for k, v in result.items()
                if k not in ('vector', 'search_text', '_distance', 'name')
            }
            all_results.append(
                {
                    'name': result.get('name', 'Unknown'),
                    'category': cat,
                    'attributes': attributes,
                    '_distance': result.get('_distance', float('inf')),
                }
            )

    # Sort by distance and take top results
    all_results.sort(key=lambda x: x['_distance'])
    top_results = all_results[: request.limit]

    return SearchResponse(
        results=[
            ProductResult(
                name=r['name'],
                category=r['category'],
                attributes=r['attributes'],
            )
            for r in top_results
        ]
    )


@app.get('/categories')
async def list_categories():
    """List all available product categories."""
    return {
        'categories': [
            {'id': cat, 'display_name': config['display_name'], 'loaded': cat in tables}
            for cat, config in CATEGORY_CONFIG.items()
        ]
    }
