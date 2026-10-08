"""Pydantic models for request bodies.

Responses are plain dicts built by services/pipeline.py so that the JSON shape is
easy to read and change during a hackathon.
"""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Classification = Literal["SUPPORTS", "CONTRADICTS", "NEUTRAL"]
Importance = Literal["high", "medium", "low"]
ClaimType = Literal["factual", "opinion", "prediction"]


class EvidenceIn(BaseModel):
    id: Optional[str] = None
    title: str
    url: Optional[str] = None
    domain: str
    snippet: str = ""
    classification: Classification
    reasoning: str = ""
    content_type: str = "web page"
    processing_method: str = "manual entry"


class ClaimIn(BaseModel):
    id: Optional[str] = None
    claim: str
    importance: Importance = "medium"
    type: ClaimType = "factual"
    evidence: List[EvidenceIn] = Field(default_factory=list)


class IndicatorIn(BaseModel):
    name: str
    severity: float = Field(ge=0.0, le=1.0)
    detail: str = ""
    method: str = "manual entry"


class CalculateTrustRequest(BaseModel):
    """Lets the team (or a judge) feed their own evidence into the scoring engine."""
    input_type: Literal["text", "image", "audio", "video"] = "text"
    input_text: str = ""
    claims: List[ClaimIn]
    manipulation_applicable: bool = False
    manipulation_indicators: List[IndicatorIn] = Field(default_factory=list)


class SearchEvidenceRequest(BaseModel):
    claim: str
    max_results: int = Field(default=4, ge=1, le=8)


class ClassifyEvidenceRequest(BaseModel):
    claim: str
    title: str = ""
    snippet: str
    url: Optional[str] = None
