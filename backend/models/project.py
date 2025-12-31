"""Project data models."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class PaperSize(str, Enum):
    """Supported paper sizes."""
    BUSINESS_CARD = "business_card"  # 85 x 55 mm
    A6 = "a6"  # 105 x 148 mm
    A5 = "a5"  # 148 x 210 mm
    A4 = "a4"  # 210 x 297 mm
    A3 = "a3"  # 297 x 420 mm
    CUSTOM = "custom"


# Paper dimensions in mm (width, height in portrait orientation)
PAPER_DIMENSIONS = {
    PaperSize.BUSINESS_CARD: (85, 55),
    PaperSize.A6: (105, 148),
    PaperSize.A5: (148, 210),
    PaperSize.A4: (210, 297),
    PaperSize.A3: (297, 420),
}


class EnvelopeSize(str, Enum):
    """Standard envelope sizes."""
    C7 = "c7"  # 81 x 114 mm
    C7_6 = "c7_6"  # 81 x 162 mm
    DL = "dl"  # 110 x 220 mm
    C6 = "c6"  # 114 x 162 mm
    C5 = "c5"  # 162 x 229 mm
    C4 = "c4"  # 229 x 324 mm


ENVELOPE_DIMENSIONS = {
    EnvelopeSize.C7: (81, 114),
    EnvelopeSize.C7_6: (81, 162),
    EnvelopeSize.DL: (220, 110),  # Landscape orientation
    EnvelopeSize.C6: (162, 114),
    EnvelopeSize.C5: (229, 162),
    EnvelopeSize.C4: (324, 229),
}


class EnvelopeAddress(BaseModel):
    """Envelope address data."""
    recipient_name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    postal_code: str
    country: Optional[str] = None

    # Envelope settings
    envelope_size: EnvelopeSize = EnvelopeSize.DL


class ProjectCreate(BaseModel):
    """Request model for creating a new project."""
    name: str = Field(..., min_length=1, max_length=100)
    paper_size: PaperSize = PaperSize.A4
    custom_width_mm: Optional[float] = None
    custom_height_mm: Optional[float] = None
    is_double_sided: bool = False
    include_envelope: bool = False
    envelope_address: Optional[EnvelopeAddress] = None


class ProjectUpdate(BaseModel):
    """Request model for updating a project."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    envelope_address: Optional[EnvelopeAddress] = None


class Project(BaseModel):
    """Full project model."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    paper_size: PaperSize
    width_mm: float
    height_mm: float
    is_double_sided: bool = False
    include_envelope: bool = False
    envelope_address: Optional[EnvelopeAddress] = None

    # Canvas state stored as JSON
    canvas_front: Optional[dict] = None
    canvas_back: Optional[dict] = None
    canvas_envelope: Optional[dict] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def from_create(cls, data: ProjectCreate) -> "Project":
        """Create a Project from ProjectCreate data."""
        if data.paper_size == PaperSize.CUSTOM:
            width = data.custom_width_mm or 210
            height = data.custom_height_mm or 297
        else:
            width, height = PAPER_DIMENSIONS[data.paper_size]

        return cls(
            name=data.name,
            paper_size=data.paper_size,
            width_mm=width,
            height_mm=height,
            is_double_sided=data.is_double_sided,
            include_envelope=data.include_envelope,
            envelope_address=data.envelope_address,
        )
