"""
Audio Insight — API Models
Pydantic schemas for request and response validation.
"""

from pydantic import BaseModel, HttpUrl


# --- Requests ---

class AnalyzeRequest(BaseModel):
    """Request body for the /analyze endpoint."""
    url: str


# --- Responses ---

class DownloadResponse(BaseModel):
    """Response after audio download step."""
    status: str
    title: str
    duration: float
    file_id: str


class ErrorResponse(BaseModel):
    """Standard error response."""
    status: str = "error"
    message: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    version: str
