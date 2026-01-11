import os

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

app = FastAPI()

r2_client = boto3.client(
    's3',
    endpoint_url=os.getenv('R2_ENDPOINT_URL'),
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name='auto',
)

BUCKET_NAME = os.getenv('R2_BUCKET_NAME')

CLIP_KEYS = {
    'cpu': 'ezpc/cpu_clip.mp4',
    'gpu': 'ezpc/gpu_clip.mp4',
    'ram': 'ezpc/ram_clip.mp4',
}


def get_presigned_url(key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL for an R2 object.

    Args:
        key: The R2 object key.
        expiration: URL expiration time in seconds (default: 1 hour).

    Returns:
        The presigned URL string.
    """
    return r2_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': key},
        ExpiresIn=expiration,
    )


@app.get('/cpu-clip')
async def get_cpu_clip():
    return {'url': get_presigned_url(CLIP_KEYS['cpu'])}


@app.get('/gpu-clip')
async def get_gpu_clip():
    return {'url': get_presigned_url(CLIP_KEYS['gpu'])}


@app.get('/ram-clip')
async def get_ram_clip():
    return {'url': get_presigned_url(CLIP_KEYS['ram'])}
