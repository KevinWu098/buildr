from enum import Enum

from pydantic import BaseModel
from sqlmodel import Field, SQLModel


class CompatibilityCheckRequest(BaseModel):
    cpu: str
    motherboard: str
    memory: str
    cpu_cooler: str


class CompatibilityCheckResponse(BaseModel):
    compatible: bool
    message: str | None = None


class ComponentTypes(str, Enum):
    cpu = 'cpu'
    motherboard = 'motherboard'
    memory = 'memory'
    cpu_cooler = 'cpu_cooler'
    video_card = 'video_card'
    case = 'case'
    power_supply = 'power_supply'
    storage = 'storage'


class Components(BaseModel):
    type: ComponentTypes
    name: str


# ============ PC Part Scraped Data Models ============


class CPU(SQLModel, table=True):
    __tablename__: str = 'cpu'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    core_count: str | None = None
    performance_core_clock: str | None = None
    performance_core_boost_clock: str | None = None
    microarchitecture: str | None = None
    tdp: str | None = None
    integrated_graphics: str | None = None
    rating: int | None = None
    price: str | None = None


class Motherboard(SQLModel, table=True):
    __tablename__: str = 'motherboard'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    socket_cpu: str | None = None
    form_factor: str | None = None
    memory_max: str | None = None
    memory_slots: str | None = None
    color: str | None = None
    rating: int | None = None
    price: str | None = None
    memory_type: str | None = None


class VideoCard(SQLModel, table=True):
    __tablename__: str = 'video_card'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    chipset: str | None = None
    memory: str | None = None
    core_clock: str | None = None
    boost_clock: str | None = None
    color: str | None = None
    length: str | None = None
    rating: int | None = None
    price: str | None = None


class Case(SQLModel, table=True):
    __tablename__: str = 'case'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    type: str | None = None
    color: str | None = None
    power_supply: str | None = None
    side_panel: str | None = None
    external_volume: str | None = None
    internal_bays: str | None = None
    rating: int | None = None
    price: str | None = None


class CPUCooler(SQLModel, table=True):
    __tablename__: str = 'cpu_cooler'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    fan_rpm: str | None = None
    noise_level: str | None = None
    color: str | None = None
    radiator_size: str | None = None
    rating: int | None = None
    price: str | None = None


class PowerSupply(SQLModel, table=True):
    __tablename__: str = 'power_supply'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    type: str | None = None
    efficiency_rating: str | None = None
    wattage: str | None = None
    modular: str | None = None
    color: str | None = None
    rating: int | None = None
    price: str | None = None


class Storage(SQLModel, table=True):
    __tablename__: str = 'storage'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    capacity: str | None = None
    price_per_gb: str | None = None
    type: str | None = None
    cache: str | None = None
    form_factor: str | None = None
    interface: str | None = None
    rating: int | None = None
    price: str | None = None


class Memory(SQLModel, table=True):
    __tablename__: str = 'memory'

    id: int | None = Field(default=None, primary_key=True)
    name: str | None = None
    url: str | None = None
    image_url: str | None = None
    speed: str | None = None
    modules: str | None = None
    price_per_gb: str | None = None
    color: str | None = None
    first_word_latency: str | None = None
    cas_latency: str | None = None
    rating: int | None = None
    price: str | None = None


# Mapping from category name to model class
CATEGORY_MODEL_MAP: dict[str, type[SQLModel]] = {
    'cpu': CPU,
    'motherboard': Motherboard,
    'video_card': VideoCard,
    'case': Case,
    'cpu_cooler': CPUCooler,
    'power_supply': PowerSupply,
    'storage': Storage,
    'memory': Memory,
}
