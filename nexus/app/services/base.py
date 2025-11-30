"""Base service class with common functionality."""

import httpx
import structlog
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import settings

logger = structlog.get_logger()


class BaseService:
    """Base class for external service clients."""
    
    def __init__(self, base_url: str, service_name: str):
        self.base_url = base_url.rstrip('/')
        self.service_name = service_name
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.health_check_timeout),
            headers={"Content-Type": "application/json"}
        )
        self.logger = logger.bind(service=service_name)
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError))
    )
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic."""
        url = f"{self.base_url}{endpoint}"
        
        self.logger.debug(
            "Making request",
            method=method,
            url=url,
            data=data,
            params=params
        )
        
        try:
            response = await self.client.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers
            )
            response.raise_for_status()
            
            result = response.json()
            self.logger.debug("Request successful", status_code=response.status_code)
            return result
            
        except httpx.HTTPStatusError as e:
            self.logger.error(
                "HTTP error",
                status_code=e.response.status_code,
                response_text=e.response.text
            )
            raise
        except httpx.RequestError as e:
            self.logger.error("Request error", error=str(e))
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Check service health."""
        try:
            start_time = httpx._utils.default_timer()
            result = await self._make_request("GET", "/health")
            response_time = httpx._utils.default_timer() - start_time
            
            return {
                "name": self.service_name,
                "healthy": True,
                "response_time": response_time,
                "details": result
            }
        except Exception as e:
            return {
                "name": self.service_name,
                "healthy": False,
                "error": str(e)
            }
