import base64
import os
from enum import Enum
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, UploadFile
from google import genai
from google.genai import types
from models import (
    CompatibilityCheckResponse,
    Components,
    ComponentTypes,
    Memory,
    Motherboard,
)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

load_dotenv()

DATABASE_URL = 'sqlite+aiosqlite:///./pcpartpicker.db'
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL')


engine = create_async_engine(DATABASE_URL)


async def get_session():
    async with AsyncSession(engine) as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]

client = genai.Client(api_key=GEMINI_API_KEY).aio

app = FastAPI()


@app.get('/')
async def root():
    return {'message': 'PCPartPicker API is running.'}


@app.post(
    '/compatibility-check',
    response_model=CompatibilityCheckResponse,
    response_model_exclude_unset=True,
)
async def check_compatibility(components: list[Components], session: SessionDep):
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


COMPONENT_IDENTIFICATION_PROMPT = """\
Identify the PC parts in this image. Return a list of the identified components.
Only identify the component if it is a CPU, memory, or motherboard. Ignore all other components.
Focus on the text on the labels of the components. If a part does not have clear indicators that it is one of the optios, do not include it in the list.
If a component is not a possible match for one of these types or names, do not include it in the list.
"""


class CPUNamesEnum(str, Enum):
    amd_ryzen_5_7600x = 'AMD Ryzen 5 7600X'
    intel_core_i7_14700k = 'Intel Core i7-14700K'
    amd_ryzen_9_5900x = 'AMD Ryzen 9 5900X'


class MemoryNamesEnum(str, Enum):
    corsair_vengeance_lpx_16_gb = 'Corsair Vengeance LPX 16 GB'
    crucial_pro_32_gb = 'Crucial Pro 32 GB'
    gskill_trident_z5_rgb_48_gb = 'G.Skill Trident Z5 RGB 48 GB'


class MotherboardNamesEnum(str, Enum):
    asus_tuf_gaming_b650e_plus_wifi = 'Asus TUF GAMING B650E-PLUS WIFI'
    msi_mag_b850_tomahawk_max_wifi = 'MSI MAG B850 TOMAHAWK MAX WIFI'
    asrock_b850m_pro_a_wifi = 'ASRock B850M Pro-A WiFi'


class CPUComponent(BaseModel):
    type: Literal['cpu']
    name: CPUNamesEnum


class MemoryComponent(BaseModel):
    type: Literal['memory']
    name: MemoryNamesEnum


class MotherboardComponent(BaseModel):
    type: Literal['motherboard']
    name: MotherboardNamesEnum


class GeminiComponentsOutput(BaseModel):
    components: list[CPUComponent | MemoryComponent | MotherboardComponent]


@app.post('/components-image-upload', response_model=None)
async def upload_component_image(components_image: UploadFile):
    if not (GEMINI_API_KEY and GEMINI_MODEL):
        raise ValueError('Gemini environment variables are not set properly.')

    # Read the uploaded file
    image_bytes = await components_image.read()
    content_type = components_image.content_type or 'image/jpeg'

    response = await client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            COMPONENT_IDENTIFICATION_PROMPT,
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=content_type,
            ),
        ],
        config={
            'response_mime_type': 'application/json',
            'response_schema': GeminiComponentsOutput,
            'temperature': 0.1,
        },
    )

    return GeminiComponentsOutput.model_validate_json(response.text)
