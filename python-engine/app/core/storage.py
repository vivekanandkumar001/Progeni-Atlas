import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("talentpulse.storage")

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    boto3 = None
    ClientError = Exception
    BOTO3_AVAILABLE = False
    logger.info("boto3 package not installed. StorageService running in mock mode.")

AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("S3_REGION", "us-east-1"))
AWS_S3_ENDPOINT = os.environ.get("AWS_S3_ENDPOINT", os.environ.get("S3_ENDPOINT", None))
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", os.environ.get("S3_ACCESS_KEY_ID", None))
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", os.environ.get("S3_SECRET_ACCESS_KEY", None))
DEFAULT_BUCKET_NAME = os.environ.get("AWS_S3_BUCKET", os.environ.get("S3_BUCKET", "talentpulse-media-assets"))


class StorageService:
    """Boto3 S3 / Cloudflare R2 object storage client utility."""

    def __init__(self, bucket_name: str = DEFAULT_BUCKET_NAME):
        self.bucket_name = bucket_name
        self.s3_client = None
        self._init_client()

    def _init_client(self):
        if BOTO3_AVAILABLE and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            try:
                self.s3_client = boto3.client(
                    "s3",
                    region_name=AWS_REGION,
                    endpoint_url=AWS_S3_ENDPOINT,
                    aws_access_key_id=AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                )
                logger.info(f"Initialized Boto3 S3 client for bucket '{self.bucket_name}' in region '{AWS_REGION}'.")
            except Exception as e:
                logger.warning(f"Failed to initialize Boto3 client: {e}. Running in mock mode.")
        else:
            logger.info("StorageService running in mock mode.")

    @staticmethod
    def get_avatar_key(user_id: str) -> str:
        return f"avatars/{user_id}.jpg"

    @staticmethod
    def get_resume_key(candidate_id: str, file_uuid: str) -> str:
        return f"resumes/{candidate_id}/{file_uuid}.pdf"

    @staticmethod
    def get_recording_key(session_id: str) -> str:
        return f"recordings/{session_id}/full_interview.mp4"

    @staticmethod
    def get_audio_snippet_key(session_id: str, turn_index: int) -> str:
        return f"audio/{session_id}/turn_{turn_index}.webm"

    def generate_presigned_upload_url(
        self, key: str, content_type: str, bucket: Optional[str] = None, expires_in_sec: int = 300
    ) -> Dict[str, str]:
        target_bucket = bucket or self.bucket_name
        public_base = os.environ.get("PUBLIC_STORAGE_BASE_URL", f"https://{target_bucket}.s3.amazonaws.com")
        public_url = f"{public_base}/{key}"

        if not self.s3_client:
            return {
                "upload_url": f"https://mock-storage.talentpulse.ai/upload/{target_bucket}/{key}?expires={expires_in_sec}",
                "file_key": key,
                "public_url": public_url,
            }

        try:
            url = self.s3_client.generate_presigned_url(
                ClientMethod="put_object",
                Params={"Bucket": target_bucket, "Key": key, "ContentType": content_type},
                ExpiresIn=expires_in_sec,
            )
            return {
                "upload_url": url,
                "file_key": key,
                "public_url": public_url,
            }
        except ClientError as e:
            logger.error(f"Error generating presigned upload URL: {e}")
            raise e

    def generate_presigned_download_url(
        self, key: str, bucket: Optional[str] = None, expires_in_sec: int = 3600
    ) -> str:
        target_bucket = bucket or self.bucket_name
        if not self.s3_client:
            public_base = os.environ.get("PUBLIC_STORAGE_BASE_URL", f"https://{target_bucket}.s3.amazonaws.com")
            return f"{public_base}/{key}"

        try:
            return self.s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": target_bucket, "Key": key},
                ExpiresIn=expires_in_sec,
            )
        except ClientError as e:
            logger.error(f"Error generating presigned download URL: {e}")
            raise e


storage_service = StorageService()
