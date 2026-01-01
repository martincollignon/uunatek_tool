/**
 * Canvas operations hook
 * Handles common canvas operations like adding text, images, frames, etc.
 */

import { Canvas, FabricImage, IText, loadSVGFromString, util } from 'fabric';
import type { FabricObject } from 'fabric';

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

  return {
    addText,
    addImageToCanvas,
    addGeminiImage,
    addQRCode,
    addFrame,
    deleteSelected,
    bringToFront,
    sendToBack,
  };
}
