import { IText, Path, Group, FabricObject } from 'fabric';

/**
 * Convert a Fabric.js text object to path objects using the text's toObject representation.
 * This is necessary for accurate plotting since plotters can't render fonts directly.
 *
 * Note: This function requires the text object to have a valid path representation.
 * If the text cannot be converted, it returns the original object with a warning.
 *
 * @param textObject The text object to convert
 * @returns JSON representation with the text object or path group
 */
export function convertTextToPathJSON(textObject: FabricObject): any {
  try {
    // Check if this is a text object
    if (!isTextObject(textObject)) {
      return textObject.toJSON();
    }

    const text = textObject as IText;

    // Get text content and styling
    const textContent = text.text || '';
    const left = text.left || 0;
    const top = text.top || 0;
    const scaleX = text.scaleX || 1;
    const scaleY = text.scaleY || 1;
    const angle = text.angle || 0;
    const stroke = text.stroke || text.fill || 'black';
    const strokeWidth = text.strokeWidth || 1;

    // For now, we'll create an SVG-based path representation
    // This will be rendered on a temporary canvas and then converted to paths
    const pathData = renderTextToPath(textContent, {
      fontSize: text.fontSize || 20,
      fontFamily: text.fontFamily || 'Arial',
      fontWeight: text.fontWeight || 'normal',
      fontStyle: text.fontStyle || 'normal',
    });

    if (!pathData) {
      console.warn('Could not convert text to path, keeping as text');
      return text.toJSON();
    }

    // Create path object with the same transforms
    return {
      type: 'path',
      path: pathData,
      left,
      top,
      scaleX,
      scaleY,
      angle,
      stroke,
      strokeWidth,
      fill: 'none', // Plotter only uses stroke
      originX: text.originX,
      originY: text.originY,
    };
  } catch (error) {
    console.error('Failed to convert text to path:', error);
    return textObject.toJSON();
  }
}

/**
 * Render text to SVG path data using a temporary SVG element.
 * This uses the browser's text rendering engine to generate accurate paths.
 *
 * @param text The text content to convert
 * @param options Font options
 * @returns SVG path data array or null if conversion fails
 */
function renderTextToPath(
  text: string,
  options: {
    fontSize: number;
    fontFamily: string;
    fontWeight: string | number;
    fontStyle: string;
  }
): any[] | null {
  try {
    // Create a temporary SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '1000');
    svg.setAttribute('height', '1000');
    svg.style.position = 'absolute';
    svg.style.left = '-9999px';
    document.body.appendChild(svg);

    // Create text element
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.textContent = text;
    textElement.setAttribute('x', '0');
    textElement.setAttribute('y', `${options.fontSize}`);
    textElement.setAttribute('font-family', options.fontFamily);
    textElement.setAttribute('font-size', `${options.fontSize}`);
    textElement.setAttribute('font-weight', `${options.fontWeight}`);
    textElement.setAttribute('font-style', options.fontStyle);
    svg.appendChild(textElement);

    // Get the computed text path
    // Note: This is a simplified approach - browsers don't expose text->path conversion directly
    // For production use, consider using a library like opentype.js

    // Clean up
    document.body.removeChild(svg);

    // Since we can't directly convert text to paths in the browser without additional libraries,
    // we'll return null and handle this differently
    return null;
  } catch (error) {
    console.error('Failed to render text to path:', error);
    return null;
  }
}

/**
 * Check if an object is a text object.
 */
function isTextObject(obj: FabricObject): boolean {
  const objJson = obj.toJSON();
  const type = objJson.type;
  return type === 'text' || type === 'i-text' || type === 'textbox';
}

/**
 * Convert all text objects in a canvas to paths.
 * This prepares the canvas for export to a plotter.
 *
 * @param canvas The canvas to process
 * @returns A new canvas JSON with text converted to paths
 */
export function convertAllTextToPath(canvas: Canvas): Record<string, any> {
  const canvasJson = canvas.toJSON();
  const objects = canvasJson.objects || [];
  const newObjects: any[] = [];

  objects.forEach((obj: any) => {
    const objType = obj.type;

    // Check if this is a text object
    if (objType === 'text' || objType === 'i-text' || objType === 'textbox') {
      // Find the actual object in the canvas
      const fabricObjects = canvas.getObjects();
      const textObject = fabricObjects.find((fo) => {
        const foJson = fo.toJSON();
        return foJson.type === objType &&
               foJson.text === obj.text &&
               foJson.left === obj.left &&
               foJson.top === obj.top;
      });

      if (textObject && textObject instanceof IText) {
        // Convert text to paths
        const paths = convertTextToPath(textObject, canvas);

        // Add each path to the new objects array
        paths.forEach((path) => {
          newObjects.push(path.toJSON());
        });
      } else {
        // If we can't find the object or convert it, keep the original
        newObjects.push(obj);
      }
    } else if (objType === 'group') {
      // Handle groups recursively
      const groupJson = convertTextInGroup(obj);
      newObjects.push(groupJson);
    } else {
      // Keep non-text objects as-is
      newObjects.push(obj);
    }
  });

  return {
    ...canvasJson,
    objects: newObjects,
  };
}

/**
 * Convert text objects within a group to paths.
 *
 * @param groupJson The group JSON to process
 * @returns Updated group JSON with text converted to paths
 */
function convertTextInGroup(groupJson: any): any {
  const objects = groupJson.objects || [];
  const newObjects: any[] = [];

  objects.forEach((obj: any) => {
    const objType = obj.type;

    if (objType === 'text' || objType === 'i-text' || objType === 'textbox') {
      // For grouped text, we'll create a simple path representation
      // Note: This is a simplified version - full implementation would need
      // access to the actual Fabric object for accurate conversion
      console.warn('Text in group detected - manual conversion recommended');
      newObjects.push(obj);
    } else if (objType === 'group') {
      // Recursively handle nested groups
      newObjects.push(convertTextInGroup(obj));
    } else {
      newObjects.push(obj);
    }
  });

  return {
    ...groupJson,
    objects: newObjects,
  };
}
