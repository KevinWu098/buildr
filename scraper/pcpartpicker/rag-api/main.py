"""Minimal RAG API for CPU queries."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import lancedb  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI
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
DATA_PATH = Path(__file__).parent / 'cpu_knowledge_base.json'
DB_PATH = Path(__file__).parent / 'cpu_vectordb'

# LanceDB connection (initialized on startup)
db = None
table = None


def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(input=text, model=AZURE_OPENAI_EMBEDDING_MODEL)
    return response.data[0].embedding


def init_vectordb():
    """Initialize LanceDB with CPU embeddings."""
    global db, table

    db = lancedb.connect(str(DB_PATH))

    # Check if table already exists
    if 'cpus' in db.table_names():
        table = db.open_table('cpus')
        print(f'Loaded existing table with {table.count_rows()} CPUs')
        return

    # Load CPU data and create embeddings
    with open(DATA_PATH) as f:
        cpu_data = json.load(f)

    print('Computing embeddings for CPU names...')
    records = []
    for cpu in cpu_data:
        embedding = get_embedding(cpu['name'])
        records.append(
            {
                'name': cpu['name'],
                'price': cpu.get('price'),
                'integrated_graphics': cpu.get('integrated_graphics'),
                'vector': embedding,
            }
        )

    table = db.create_table('cpus', records)
    print(f'Created table with {len(records)} CPUs')


def find_relevant_cpu(query: str) -> dict | None:
    """Find the most relevant CPU using vector similarity search."""
    if table is None:
        return None

    query_embedding = get_embedding(query)
    results = table.search(query_embedding).limit(1).to_list()

    if not results:
        return None

    row = results[0]
    return {
        'name': row['name'],
        'price': row['price'],
        'integrated_graphics': row['integrated_graphics'],
    }


def generate_response(query: str, cpu: dict) -> str:
    """Generate a natural language response using the CPU data."""
    context = f"""CPU Information:
- Name: {cpu['name']}
- Price: {cpu['price'] or 'Not available'}
- Integrated Graphics: {cpu['integrated_graphics'] or 'None'}"""

    response = client.chat.completions.create(
        model=AZURE_OPENAI_MODEL,
        messages=[
            {
                'role': 'system',
                'content': 'You answer questions about CPUs based on the provided data. Be concise and direct. Only answer questions about price or integrated graphics.',
            },
            {'role': 'user', 'content': f'Context:\n{context}\n\nQuestion: {query}'},
        ],
    )
    return response.choices[0].message.content or ''


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_vectordb()
    yield


app = FastAPI(lifespan=lifespan)


class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    answer: str
    matched_cpu: str


@app.post('/query', response_model=QueryResponse)
async def query_cpu(request: QueryRequest):
    """Query the CPU knowledge base with a natural language question."""
    cpu = find_relevant_cpu(request.query)
    if not cpu:
        return QueryResponse(answer='No matching CPU found.', matched_cpu='')

    answer = generate_response(request.query, cpu)
    return QueryResponse(answer=answer, matched_cpu=cpu['name'])
