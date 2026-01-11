import base64
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, UploadFile
from models import (
    CATEGORY_MODEL_MAP,
    CompatibilityCheckResponse,
    Components,
    ComponentTypes,
    ImageComponentsResponse,
    Memory,
    Motherboard,
    OpenAIComponentsOutput,
)
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

load_dotenv()

DATABASE_URL = 'sqlite+aiosqlite:///./pcpartpicker.db'
AZURE_OPENAI_BASE_URL = os.getenv('AZURE_OPENAI_BASE_URL')
AZURE_OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY')
AZURE_OPENAI_MODEL = os.getenv('AZURE_OPENAI_MODEL')


engine = create_async_engine(DATABASE_URL)


async def get_session():
    async with AsyncSession(engine) as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]

client = AsyncOpenAI(
    base_url=AZURE_OPENAI_BASE_URL,
    api_key=AZURE_OPENAI_API_KEY,
)

app = FastAPI()


@app.get('/')
async def root():
    return {'message': 'PCPartPicker API is running.'}


async def _check_compatibility(
    components: list[Components], session: AsyncSession
) -> CompatibilityCheckResponse:
    """Internal compatibility check logic that can be reused by multiple endpoints."""
    rams = set()
    motherboards = set()

    for component in components:
        if component.type is ComponentTypes.memory:
            rams.add(component.name)
        elif component.type is ComponentTypes.motherboard:
            motherboards.add(component.name)

    ram_rows: list[Memory] = []
    motherboard_rows: list[Motherboard] = []

    for ram in rams:
        result = await session.exec(
            select(Memory)
            .where(col(Memory.name).icontains(ram))
            .order_by(col(Memory.id).asc())
        )
        ram_row = result.first()
        if ram_row:
            ram_rows.append(ram_row)

    for motherboard in motherboards:
        result = await session.exec(
            select(Motherboard)
            .where(col(Motherboard.name).icontains(motherboard))
            .order_by(col(Motherboard.id).asc())
        )
        motherboard_row = result.first()
        if motherboard_row:
            motherboard_rows.append(motherboard_row)

    for memory in ram_rows:
        memory_type = memory.speed[:4] if memory.speed else None
        for motherboard in motherboard_rows:
            if motherboard.memory_type and memory_type:
                if motherboard.memory_type != memory_type:
                    return CompatibilityCheckResponse(
                        compatible=False,
                        message=f'Incompatible memory type: Motherboard requires {motherboard.memory_type}, but memory is {memory_type}.',
                    )

    return CompatibilityCheckResponse(compatible=True)


@app.post(
    '/compatibility-check',
    response_model=CompatibilityCheckResponse,
    response_model_exclude_unset=True,
)
async def check_compatibility(components: list[Components], session: SessionDep):
    return await _check_compatibility(components, session)


COMPONENT_IDENTIFICATION_PROMPT = """\
Identify the PC parts in this image. Return a list of the identified components.
Only identify the component if it is a CPU, memory, or motherboard. Ignore all other components.
The type field of the component should be one of: cpu, memory, motherboard.
For CPUs, identify from this list: AMD Ryzen 5 7600X, Intel Core i7-14700K, AMD Ryzen 9 5900X.
If a component is a CPU, and is not in the list, omit it from the results.
For memory, identify from this list: Corsair Vengeance LPX 16 GB, Crucial Pro 32 GB, G.Skill Trident Z5 RGB 48 GB.
If a component is memory, and is not in the list, omit it from the results.
For motherboards, identify from this list: Asus TUF GAMING B650E-PLUS WIFI, MSI MAG B850 TOMAHAWK MAX WIFI, ASRock B850M Pro-A WiFi.
If a component is a motherboard, and is not in the list, omit it from the results.
For the name field of the component, return the exact name as in the list above, without any additional details or changes.
Focus on the text on the labels of the components. If a part does not have clear indicators that it is one of the options, do not include it in the list.
If a component is not a possible match for one of these types or names, do not include it in the list.
"""


@app.post(
    '/components-image-upload',
    response_model=ImageComponentsResponse,
    response_model_exclude_unset=True,
)
async def upload_component_image(components_image: UploadFile, session: SessionDep):
    if not (AZURE_OPENAI_BASE_URL and AZURE_OPENAI_API_KEY and AZURE_OPENAI_MODEL):
        raise ValueError('Azure OpenAI environment variables are not set properly.')

    # Read and encode the uploaded file as base64
    file_content = await components_image.read()
    base64_image = base64.b64encode(file_content).decode('utf-8')
    content_type = components_image.content_type or 'image/jpeg'
    data_url = f'data:{content_type};base64,{base64_image}'

    response = await client.responses.parse(
        model=AZURE_OPENAI_MODEL,
        max_output_tokens=2000,
        temperature=0.0,
        input=[
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'input_text',
                        'text': COMPONENT_IDENTIFICATION_PROMPT,
                    },
                    {
                        'type': 'input_image',
                        'image_url': data_url,
                    },
                ],
            }  # type: ignore
        ],
        text_format=OpenAIComponentsOutput,
    )

    parsed_components = response.output_parsed
    components_list = parsed_components.components if parsed_components else []

    # Run compatibility check on identified components
    compatibility_result = await _check_compatibility(components_list, session)

    return ImageComponentsResponse(
        components=components_list,
        compatible=compatibility_result.compatible,
        message=compatibility_result.message,
    )


@app.get('/manual-search')
async def manual_search(query: str, session: SessionDep):
    """Endpoint to manually search for components by name across all tables."""
    results: list[dict] = []

    for category, model in CATEGORY_MODEL_MAP.items():
        remaining = 10 - len(results)
        if remaining <= 0:
            break

        result = await session.exec(
            select(model)
            .where(col(model.name).icontains(query))  # type: ignore
            .order_by(col(model.id).asc())  # type: ignore
            .limit(remaining)
        )
        rows = result.all()
        for row in rows:
            results.append({'category': category, **row.model_dump()})
            if len(results) >= 10:
                break
        if len(results) >= 10:
            break

    if results:
        return results
    return {'message': 'No matching component found.'}
