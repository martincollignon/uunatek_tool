/**
 * Canvas operations hook
 * Handles common canvas operations like adding text, images, frames, etc.
 */

import { Canvas, FabricImage, IText, Rect, Circle, Line, Group, loadSVGFromString, util } from 'fabric';
import type { FabricObject } from 'fabric';
import {
  createHorizontalLinesFill,
  createVerticalLinesFill,
  createDiagonalLinesFill,
  createCrossHatchFill,
  createDotsFill,
  createCircleHorizontalLinesFill,
  createCircleVerticalLinesFill,
  createCircleCrossHatchFill,
  createCircleDotsFill,
  type ShapeFillType,
} from '../utils/shapeFillPatterns';

export function useCanvasOperations(canvas: Canvas | null) {
  const addText = () => {
    if (!canvas) return;

    const text = new IText('Double-click to edit', {
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fontSize: 24,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 0,
      editable: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  };

  const addImageToCanvas = async (dataUrl: string) => {
    if (!canvas) return;

    try {
      const img = await FabricImage.fromURL(dataUrl);

      // Scale to fit canvas if too large
      const maxDim = Math.max(canvas.width!, canvas.height!) * 0.8;
      if (img.width! > maxDim || img.height! > maxDim) {
        const scale = maxDim / Math.max(img.width!, img.height!);
        img.scale(scale);
      }

      img.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    } catch (error) {
      console.error('Failed to add image to canvas:', error);
      throw error;
    }
  };

  const addGeminiImage = async (imageBase64: string) => {
    if (!canvas) return;

    const dataUrl = `data:image/png;base64,${imageBase64}`;
    const img = await FabricImage.fromURL(dataUrl);

    // Scale to fit
    const maxDim = Math.max(canvas.width!, canvas.height!) * 0.8;
    if (img.width! > maxDim || img.height! > maxDim) {
      const scale = maxDim / Math.max(img.width!, img.height!);
      img.scale(scale);
    }

    img.set({
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      originX: 'center',
      originY: 'center',
    });

    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  };

  const addQRCode = async (svg: string, widthMm: number, heightMm: number) => {
    if (!canvas) return;

    // Canvas scale: 3 pixels per mm
    const SCALE = 3;

    // Parse SVG and load into fabric
    const { objects } = await loadSVGFromString(svg);

    // Filter out null objects
    const validObjects = objects.filter((obj): obj is FabricObject => obj !== null);

    if (validObjects.length > 0) {
      // Group all SVG objects together
      const group = util.groupSVGElements(validObjects);

      // Scale from mm to canvas pixels
      const targetWidth = widthMm * SCALE;
      const targetHeight = heightMm * SCALE;
      const scaleX = targetWidth / (group.width || 1);
      const scaleY = targetHeight / (group.height || 1);

      group.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scaleX,
        scaleY: scaleY,
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
    }
  };

  const addFrame = (frame: FabricObject) => {
    if (!canvas) return;

    canvas.add(frame);
    canvas.setActiveObject(frame);
    canvas.requestRenderAll();
  };

  const deleteSelected = () => {
    if (!canvas) return;

    const active = canvas.getActiveObjects();
    if (active.length > 0) {
      active.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return true;
    }
    return false;
  };

  const bringToFront = (object: FabricObject) => {
    if (!canvas) return;

    canvas.bringObjectToFront(object);
    canvas.requestRenderAll();
    // Trigger a modified event to update the layer panel
    canvas.fire('object:modified', { target: object });
  };

  const sendToBack = (object: FabricObject) => {
    if (!canvas) return;

    canvas.sendObjectToBack(object);
    canvas.requestRenderAll();
    // Trigger a modified event to update the layer panel
    canvas.fire('object:modified', { target: object });
  };

  const addRectangle = (fillType: ShapeFillType = 'none') => {
    if (!canvas) return;

    const width = 150;
    const height = 100;

    if (fillType === 'none') {
      // Simple rectangle outline
      const rect = new Rect({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        width,
        height,
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 2,
      });

      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.requestRenderAll();
    } else {
      // Rectangle with fill pattern
      const outline = new Rect({
        left: 0,
        top: 0,
        width,
        height,
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 2,
        originX: 'left',  // Fabric 7 defaults to 'center', need 'left' for proper positioning
        originY: 'top',   // Fabric 7 defaults to 'center', need 'top' for proper positioning
      });

      let fillObjects: FabricObject[] = [];
      const fillOptions = { width, height, spacingMm: 2, strokeWidth: 1, stroke: '#000000' };

      switch (fillType) {
        case 'horizontal-lines':
          fillObjects = createHorizontalLinesFill(fillOptions);
          break;
        case 'vertical-lines':
          fillObjects = createVerticalLinesFill(fillOptions);
          break;
        case 'diagonal-lines':
          fillObjects = createDiagonalLinesFill(fillOptions);
          break;
        case 'cross-hatch':
          fillObjects = createCrossHatchFill(fillOptions);
          break;
        case 'dots':
          fillObjects = createDotsFill(fillOptions);
          break;
      }

      const group = new Group([outline, ...fillObjects], {
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
      });

      // Store metadata about the fill
      (group as any).shapeType = 'rectangle';
      (group as any).shapeFillType = fillType;
      (group as any).shapeFillSpacing = 2;

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
    }
  };

  const addCircle = (fillType: ShapeFillType = 'none') => {
    if (!canvas) return;

    const radius = 50;

    if (fillType === 'none') {
      // Simple circle outline
      const circle = new Circle({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        radius,
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 2,
      });

      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.requestRenderAll();
    } else {
      // Circle with fill pattern
      const outline = new Circle({
        left: 0,
        top: 0,
        radius,
        fill: 'transparent',
        stroke: '#000000',
        strokeWidth: 2,
      });

      let fillObjects: FabricObject[] = [];
      const fillOptions = { radius, spacingMm: 2, strokeWidth: 1, stroke: '#000000' };

      switch (fillType) {
        case 'horizontal-lines':
          fillObjects = createCircleHorizontalLinesFill(fillOptions);
          break;
        case 'vertical-lines':
          fillObjects = createCircleVerticalLinesFill(fillOptions);
          break;
        case 'cross-hatch':
          fillObjects = createCircleCrossHatchFill(fillOptions);
          break;
        case 'dots':
          fillObjects = createCircleDotsFill(fillOptions);
          break;
        case 'diagonal-lines':
          // For circles, use horizontal lines at 45 degree angle
          fillObjects = createCircleHorizontalLinesFill(fillOptions);
          break;
      }

      const group = new Group([outline, ...fillObjects], {
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
      });

      // Store metadata about the fill
      (group as any).shapeType = 'circle';
      (group as any).shapeFillType = fillType;
      (group as any).shapeFillSpacing = 2;

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
    }
  };

  const addLine = () => {
    if (!canvas) return;

    const line = new Line([
      canvas.width! / 2 - 75,
      canvas.height! / 2,
      canvas.width! / 2 + 75,
      canvas.height! / 2,
    ], {
      stroke: '#000000',
      strokeWidth: 2,
    });

    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.requestRenderAll();
  };

  const addMapSvg = async (svg: string, widthMm: number, heightMm: number) => {
    if (!canvas) return;

    // Canvas scale: 3 pixels per mm
    const SCALE = 3;

    // Parse SVG and load into fabric
    const { objects } = await loadSVGFromString(svg);

    // Filter out null objects
    const validObjects = objects.filter((obj): obj is FabricObject => obj !== null);

    if (validObjects.length > 0) {
      // Group all SVG objects together
      const group = util.groupSVGElements(validObjects);

      // Scale from mm to canvas pixels
      const targetWidth = widthMm * SCALE;
      const targetHeight = heightMm * SCALE;
      const scaleX = targetWidth / (group.width || 1);
      const scaleY = targetHeight / (group.height || 1);

      group.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scaleX,
        scaleY: scaleY,
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
    }
  };

  return {
    addText,
    addImageToCanvas,
    addGeminiImage,
    addQRCode,
    addFrame,
    deleteSelected,
    bringToFront,
    sendToBack,
    addRectangle,
    addCircle,
    addLine,
    addMapSvg,
  };
}
