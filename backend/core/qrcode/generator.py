"""QR code generator that produces SVG output for pen plotting."""

from typing import Literal
import qrcodegen


ErrorCorrectionLevel = Literal["L", "M", "Q", "H"]


class QRCodeGenerator:
    """Generate QR codes as SVG for pen plotter output."""

    # Map string error correction levels to qrcodegen constants
    ERROR_CORRECTION_MAP = {
        "L": qrcodegen.QrCode.Ecc.LOW,
        "M": qrcodegen.QrCode.Ecc.MEDIUM,
        "Q": qrcodegen.QrCode.Ecc.QUARTILE,
        "H": qrcodegen.QrCode.Ecc.HIGH,
    }

    def generate_svg(
        self,
        content: str,
        error_correction: ErrorCorrectionLevel = "H",
        size_mm: float = 40.0,
        border: int = 4,
    ) -> tuple[str, float, float]:
        """
        Generate a QR code as SVG.

        Args:
            content: The text/URL to encode in the QR code
            error_correction: Error correction level (L, M, Q, H)
                - L: ~7% recovery
                - M: ~15% recovery
                - Q: ~25% recovery
                - H: ~30% recovery (recommended for pen plotters)
            size_mm: Target size in millimeters (width = height)
            border: Number of quiet zone modules around the QR code

        Returns:
            Tuple of (svg_string, width_mm, height_mm)
        """
        # Get error correction level
        ecc = self.ERROR_CORRECTION_MAP.get(
            error_correction.upper(), qrcodegen.QrCode.Ecc.HIGH
        )

        # Generate QR code
        qr = qrcodegen.QrCode.encode_text(content, ecc)

        # Calculate dimensions
        # QR code size in modules (including border)
        qr_size = qr.get_size()
        total_modules = qr_size + (border * 2)

        # Calculate module size to achieve target size
        module_size_mm = size_mm / total_modules

        # Actual dimensions
        width_mm = size_mm
        height_mm = size_mm

        # Generate SVG
        svg = self._generate_svg_string(qr, module_size_mm, border, width_mm, height_mm)

        return svg, width_mm, height_mm

    def _generate_svg_string(
        self,
        qr: qrcodegen.QrCode,
        module_size_mm: float,
        border: int,
        width_mm: float,
        height_mm: float,
    ) -> str:
        """Generate SVG string from QR code data."""
        parts = []

        # SVG header with viewBox in mm
        parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {width_mm} {height_mm}" '
            f'width="{width_mm}mm" height="{height_mm}mm">'
        )

        # White background (optional, but helps with preview)
        parts.append(
            f'<rect x="0" y="0" width="{width_mm}" height="{height_mm}" fill="white"/>'
        )

        # Generate rectangles for each black module
        qr_size = qr.get_size()
        for y in range(qr_size):
            for x in range(qr_size):
                if qr.get_module(x, y):
                    # Calculate position with border offset
                    rect_x = (x + border) * module_size_mm
                    rect_y = (y + border) * module_size_mm

                    parts.append(
                        f'<rect x="{rect_x:.4f}" y="{rect_y:.4f}" '
                        f'width="{module_size_mm:.4f}" height="{module_size_mm:.4f}" '
                        f'fill="black" stroke="black" stroke-width="0.1"/>'
                    )

        parts.append("</svg>")

        return "\n".join(parts)
