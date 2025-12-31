"""QR code generation API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from core.qrcode import QRCodeGenerator

router = APIRouter(prefix="/api/qrcode", tags=["qrcode"])


class GenerateRequest(BaseModel):
    """Request to generate a QR code."""

    content: str = Field(..., min_length=1, description="Text or URL to encode")
    error_correction: Literal["L", "M", "Q", "H"] = Field(
        default="H",
        description="Error correction level: L(7%), M(15%), Q(25%), H(30%)",
    )
    size_mm: float = Field(
        default=40.0,
        ge=25.0,
        le=80.0,
        description="Target size in millimeters (25-80mm)",
    )
    border: int = Field(
        default=4,
        ge=0,
        le=10,
        description="Quiet zone modules around QR code",
    )


class GenerateResponse(BaseModel):
    """QR code generation response."""

    svg: str = Field(..., description="SVG string of the QR code")
    width_mm: float = Field(..., description="Width in millimeters")
    height_mm: float = Field(..., description="Height in millimeters")


@router.post("/generate", response_model=GenerateResponse)
async def generate_qrcode(request: GenerateRequest):
    """
    Generate a QR code as SVG for pen plotting.

    The QR code is optimized for pen plotter output:
    - Default error correction is HIGH (30%) for tolerance to pen variations
    - Default size is 40mm for reliable scanning
    - Output is SVG with rect elements for each module
    """
    try:
        generator = QRCodeGenerator()
        svg, width_mm, height_mm = generator.generate_svg(
            content=request.content,
            error_correction=request.error_correction,
            size_mm=request.size_mm,
            border=request.border,
        )

        return GenerateResponse(
            svg=svg,
            width_mm=width_mm,
            height_mm=height_mm,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"QR code generation failed: {e}",
        )
