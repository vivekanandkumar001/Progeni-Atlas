"""Cloudinary is the ONLY persistent file/media store. PG keeps metadata only."""
from __future__ import annotations

import io
from dataclasses import dataclass

import cloudinary
import cloudinary.exceptions
from cloudinary import uploader

from app.config import settings


class StorageError(RuntimeError):
    pass


@dataclass(frozen=True)
class StoredFile:
    public_id: str
    secure_url: str
    resource_type: str
    file_name: str
    file_size: int
    mime_type: str
    bytes: int


def _configure() -> None:
    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise StorageError("Cloudinary credentials are not configured")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def get_client() -> None:
    """Validates credentials and configures the SDK. Raises if unusable."""
    _configure()


def upload_bytes(
    data: bytes,
    *,
    folder: str,
    filename: str,
    mime_type: str,
    resource_type: str = "raw",
    purpose: str = "resume",
) -> StoredFile:
    """Upload in-memory bytes. Files are streamed to Cloudinary, never written to PG."""
    if not data:
        raise StorageError("Refusing to upload an empty file")
    _configure()
    try:
        result = uploader.upload(
            io.BytesIO(data),
            folder=folder,
            resource_type=resource_type,
            overwrite=False,
            use_filename=False,
            filename=filename,
            tags=[f"purpose:{purpose}"],
        )
    except cloudinary.exceptions.Error as exc:
        raise StorageError(f"Cloudinary upload failed: {exc}") from exc

    if not result or result.get("error"):
        raise StorageError(f"Cloudinary upload failed: {result}")

    return StoredFile(
        public_id=result["public_id"],
        secure_url=result["secure_url"],
        resource_type=result.get("resource_type", resource_type),
        file_name=filename,
        file_size=result.get("bytes", len(data)),
        mime_type=mime_type,
        bytes=result.get("bytes", len(data)),
    )


def delete(public_id: str, resource_type: str = "raw") -> None:
    _configure()
    try:
        uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
    except cloudinary.exceptions.Error as exc:
        raise StorageError(f"Cloudinary delete failed: {exc}") from exc
