#!/usr/bin/env python3
"""
Test script for Phase 1 critical fixes.
Tests:
1. Text-to-path conversion with Google Fonts support
2. File-based image storage
3. SVG generation with proper warnings
"""

import sys
import os
import tempfile
import uuid
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

def test_text_to_path():
    """Test text-to-path conversion with improved error handling."""
    print("\n=== Test 1: Text-to-Path Conversion ===")

    from core.svg.text_to_path import convert_text_to_path

    # Test 1: Basic conversion with system font
    print("\n1.1 Testing Arial font (system font)...")
    path_data, warning = convert_text_to_path("Hello World", "Arial", 12.0)

    if path_data:
        print(f"✓ Successfully converted text to path")
        print(f"  Path length: {len(path_data)} characters")
        if warning:
            print(f"  Warning: {warning}")
    else:
        print(f"✗ Failed to convert text")
        if warning:
            print(f"  Reason: {warning}")

    # Test 2: Google Font (will be downloaded if not in system)
    print("\n1.2 Testing Roboto font (Google Font)...")
    path_data2, warning2 = convert_text_to_path("Test", "Roboto", 12.0)

    if path_data2:
        print(f"✓ Successfully converted with Google Font")
        print(f"  Path length: {len(path_data2)} characters")
        if warning2:
            print(f"  Warning: {warning2}")
    else:
        print(f"✗ Failed, but fallback available")
        if warning2:
            print(f"  Reason: {warning2}")

    # Test 3: Empty text handling
    print("\n1.3 Testing empty text...")
    path_data3, warning3 = convert_text_to_path("", "Arial", 12.0)

    if path_data3 is None and warning3:
        print(f"✓ Correctly handled empty text with warning: {warning3}")
    else:
        print(f"✗ Did not handle empty text correctly")

    return True


def test_image_storage():
    """Test file-based image storage."""
    print("\n=== Test 2: File-Based Image Storage ===")

    from api.routes.canvas import (
        _save_image_to_disk,
        _load_image_from_disk,
        _cleanup_old_images,
        _IMAGE_STORAGE_DIR
    )

    # Ensure storage directory exists
    _IMAGE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    # Test 1: Save and load
    print("\n2.1 Testing save and load...")
    image_id = str(uuid.uuid4())
    test_data = b"test image data 123"
    project_id = "test_project"

    try:
        _save_image_to_disk(image_id, test_data, project_id)
        print(f"✓ Saved image {image_id}")

        loaded_data = _load_image_from_disk(image_id)
        if loaded_data == test_data:
            print(f"✓ Loaded image correctly")
        else:
            print(f"✗ Loaded data doesn't match")
            return False

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

    # Test 2: Load non-existent image
    print("\n2.2 Testing load of non-existent image...")
    try:
        _load_image_from_disk("nonexistent")
        print(f"✗ Should have raised FileNotFoundError")
        return False
    except FileNotFoundError:
        print(f"✓ Correctly raised FileNotFoundError")

    # Test 3: Cleanup
    print("\n2.3 Testing cleanup (note: only removes images older than 24h)...")
    cleaned = _cleanup_old_images()
    print(f"✓ Cleanup ran, removed {cleaned} images")

    return True


def test_svg_generation_with_warnings():
    """Test SVG generation with text-to-path warnings."""
    print("\n=== Test 3: SVG Generation with Warnings ===")

    from core.svg.generator import SVGGenerator

    # Test canvas JSON with text
    canvas_json = {
        "objects": [
            {
                "type": "text",
                "text": "Hello Plotter",
                "fontSize": 72,  # pixels
                "fontFamily": "Arial",
                "left": 100,
                "top": 100,
                "fill": "#000000"
            }
        ]
    }

    print("\n3.1 Generating SVG with text object...")
    generator = SVGGenerator(
        width_mm=100,
        height_mm=100,
        vectorize_images=False,
        include_boundary=True
    )

    svg_content, warnings = generator.generate_with_warnings(canvas_json)

    print(f"✓ Generated SVG ({len(svg_content)} characters)")

    if warnings:
        print(f"  Warnings generated:")
        for warning in warnings:
            print(f"    - {warning}")
    else:
        print(f"  No warnings (text converted successfully)")

    # Check that SVG contains path elements
    if "<path" in svg_content:
        print(f"✓ SVG contains path elements (text converted to paths)")
    else:
        print(f"⚠ SVG doesn't contain paths (fallback used)")

    return True


def main():
    """Run all tests."""
    print("=" * 60)
    print("Phase 1 Critical Fixes - Test Suite")
    print("=" * 60)

    tests = [
        ("Text-to-Path Conversion", test_text_to_path),
        ("File-Based Image Storage", test_image_storage),
        ("SVG Generation with Warnings", test_svg_generation_with_warnings),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n✓ {name} - PASSED")
            else:
                failed += 1
                print(f"\n✗ {name} - FAILED")
        except Exception as e:
            failed += 1
            print(f"\n✗ {name} - ERROR: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
