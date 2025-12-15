"""Google Cloud Storage service for Hero Banner image management."""

from __future__ import annotations

import logging
import os
import uuid
from typing import Optional, Tuple

from google.cloud import storage
from google.cloud.exceptions import NotFound

logger = logging.getLogger(__name__)

# GCS Configuration
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
GCS_PROJECT_ID = os.getenv("GCS_PROJECT_ID", "")
HERO_IMAGES_FOLDER = "hero_images"

# Global client instance
_storage_client: Optional[storage.Client] = None
_bucket: Optional[storage.Bucket] = None


def init_gcs_client() -> bool:
    """
    Initialize Google Cloud Storage client.

    Returns:
        bool: True if initialization successful, False otherwise.
    """
    global _storage_client, _bucket

    if not GCS_BUCKET_NAME:
        logger.warning("GCS_BUCKET_NAME not set, GCS service not available")
        return False

    try:
        # In Cloud Run, credentials are automatically provided via Service Account
        _storage_client = storage.Client(project=GCS_PROJECT_ID if GCS_PROJECT_ID else None)
        _bucket = _storage_client.bucket(GCS_BUCKET_NAME)

        # Verify bucket exists
        if not _bucket.exists():
            logger.error(f"GCS bucket '{GCS_BUCKET_NAME}' does not exist")
            return False

        logger.info(f"GCS client initialized successfully for bucket: {GCS_BUCKET_NAME}")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize GCS client: {e}")
        return False


def get_gcs_client() -> Optional[storage.Client]:
    """Get the GCS client instance."""
    return _storage_client


def get_bucket() -> Optional[storage.Bucket]:
    """Get the GCS bucket instance."""
    return _bucket


def upload_hero_image(
    file_data: bytes,
    filename: str,
    content_type: str = "image/jpeg"
) -> Tuple[bool, str, str]:
    """
    Upload a hero image to GCS.

    Args:
        file_data: Image file data as bytes.
        filename: Original filename (used for extension).
        content_type: MIME type of the image.

    Returns:
        Tuple of (success, object_name, public_url).
    """
    if not _bucket:
        logger.error("GCS bucket not initialized")
        return False, "", ""

    try:
        # Generate unique filename
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"

        unique_name = f"{uuid.uuid4().hex}{ext}"
        object_name = f"{HERO_IMAGES_FOLDER}/{unique_name}"

        # Upload to GCS
        blob = _bucket.blob(object_name)
        blob.upload_from_string(
            file_data,
            content_type=content_type
        )

        # Bucket-level IAM/public access should govern visibility; avoid ACL-based make_public
        public_url = blob.public_url
        logger.info(f"Uploaded hero image: {object_name}")

        return True, object_name, public_url

    except Exception as e:
        logger.error(f"Failed to upload hero image: {e}")
        return False, "", ""


def delete_hero_image(object_name: str) -> bool:
    """
    Delete a hero image from GCS.

    Args:
        object_name: The GCS object name (e.g., 'hero_images/xxx.jpg').

    Returns:
        bool: True if deletion successful, False otherwise.
    """
    if not _bucket:
        logger.error("GCS bucket not initialized")
        return False

    try:
        blob = _bucket.blob(object_name)
        blob.delete()
        logger.info(f"Deleted hero image: {object_name}")
        return True

    except NotFound:
        logger.warning(f"Hero image not found in GCS: {object_name}")
        return True  # Consider it success if already gone

    except Exception as e:
        logger.error(f"Failed to delete hero image: {e}")
        return False


def get_public_url(object_name: str) -> str:
    """
    Get the public URL for a GCS object.

    Args:
        object_name: The GCS object name.

    Returns:
        str: Public URL for the object.
    """
    return f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{object_name}"
