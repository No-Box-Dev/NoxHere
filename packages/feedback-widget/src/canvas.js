/**
 * Drawing canvas for annotations
 */

import { debugLog } from './debug.js';

let canvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'arrow'; // arrow, rectangle, text, draw
let canvasDisabled = false; // When element picker is active
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;
let paths = []; // Store all drawn paths for redraw
let currentPath = null;
let textInput = null;

const STROKE_COLOR = '#9B78F4'; // Purple from brand
const STROKE_WIDTH = 8;
const FONT_SIZE = 24;

/**
 * Initialize the drawing canvas
 * @param {HTMLCanvasElement} canvasEl - The canvas element
 */
export function initCanvas(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');

  // Canvas size is already set to match the image's natural size in overlay.js
  // Don't resize here - keep the natural dimensions for proper scaling

  // Set drawing styles (responsive for mobile)
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = isMobile ? 4 : STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Apply disabled state if element picker was activated before canvas init
  if (canvasDisabled) {
    canvas.style.pointerEvents = 'none';
  }

  // Add event listeners
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseUp);

  // Touch support
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);

  debugLog('[NoxSpot] Canvas initialized', { width: canvas.width, height: canvas.height, disabled: canvasDisabled });
}

/**
 * Set the current drawing tool
 * @param {string} tool - 'draw', 'arrow', or 'rectangle'
 */
export function setTool(tool) {
  currentTool = tool;
  debugLog('[NoxSpot] Tool set to:', tool);
}

/**
 * Disable canvas drawing (when element picker is active)
 */
export function disableCanvas() {
  canvasDisabled = true;
  if (canvas) canvas.style.pointerEvents = 'none';
}

/**
 * Enable canvas drawing
 */
export function enableCanvas() {
  canvasDisabled = false;
  if (canvas) canvas.style.pointerEvents = 'auto';
}

/**
 * Get the current tool
 */
export function getTool() {
  return currentTool;
}

/**
 * Clear all annotations
 */
export function clearCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paths = [];
  debugLog('[NoxSpot] Canvas cleared');
}

/**
 * Undo last annotation
 */
export function undoLast() {
  if (paths.length === 0) return;
  paths.pop();
  redrawAll();
  debugLog('[NoxSpot] Undo - paths remaining:', paths.length);
}

/**
 * Get canvas as data URL
 */
export function getCanvasDataURL() {
  if (!canvas) return null;
  return canvas.toDataURL('image/png');
}

/**
 * Check if canvas has annotations
 */
export function hasAnnotations() {
  return paths.length > 0;
}

// Mouse event handlers
function handleMouseDown(e) {
  if (canvasDisabled) return; // Don't draw when element picker is active
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  startX = (e.clientX - rect.left) * scaleX;
  startY = (e.clientY - rect.top) * scaleY;
  lastX = startX;
  lastY = startY;

  if (currentTool === 'text') {
    // Show text input at click position
    showTextInput(e.clientX, e.clientY, startX, startY);
    return;
  }

  isDrawing = true;

  if (currentTool === 'draw') {
    currentPath = {
      type: 'draw',
      points: [{ x: startX, y: startY }],
    };
  }
}

function handleMouseMove(e) {
  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if (currentTool === 'draw') {
    // Freehand drawing
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    currentPath.points.push({ x, y });
    lastX = x;
    lastY = y;
  } else {
    // For arrow and rectangle, redraw preview
    redrawAll();
    drawPreview(x, y);
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const endX = (e.clientX - rect.left) * scaleX;
  const endY = (e.clientY - rect.top) * scaleY;

  if (currentTool === 'draw' && currentPath) {
    paths.push(currentPath);
    currentPath = null;
  } else if (currentTool === 'arrow') {
    paths.push({
      type: 'arrow',
      startX, startY, endX, endY,
    });
    redrawAll();
  } else if (currentTool === 'rectangle') {
    paths.push({
      type: 'rectangle',
      startX, startY, endX, endY,
    });
    redrawAll();
  }
}

// Text input handling
function showTextInput(screenX, screenY, canvasX, canvasY) {
  // Remove existing text input if any
  hideTextInput();

  // Create container for text input
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  let topPos = screenY;

  // On mobile, keep input above the virtual keyboard
  if (isMobile && window.visualViewport) {
    const vv = window.visualViewport;
    topPos = Math.min(screenY, vv.offsetTop + vv.height - 50);
  }

  const container = document.createElement('div');
  container.id = 'noxspot-text-container';
  container.style.cssText = `
    position: fixed;
    left: ${screenX}px;
    top: ${topPos}px;
    z-index: 2147483647;
    transform: translate(0, -50%);
  `;

  textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.style.cssText = `
    background: white;
    border: 2px solid ${STROKE_COLOR};
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #201E1D;
    outline: none;
    min-width: 150px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  textInput.placeholder = 'Type text...';

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (textInput.value.trim()) {
        addText(canvasX, canvasY, textInput.value.trim());
      }
      hideTextInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideTextInput();
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (textInput && textInput.value.trim()) {
        addText(canvasX, canvasY, textInput.value.trim());
      }
      hideTextInput();
    }, 100);
  };

  textInput.addEventListener('keydown', handleKeyDown);
  textInput.addEventListener('blur', handleBlur);

  container.appendChild(textInput);
  document.body.appendChild(container);

  // Focus after a short delay to ensure DOM is ready
  setTimeout(() => {
    if (textInput) textInput.focus();
  }, 10);

  debugLog('[NoxSpot] Text input shown at', screenX, screenY);
}

function hideTextInput() {
  const container = document.getElementById('noxspot-text-container');
  if (container) {
    container.remove();
  }
  textInput = null;
}

function addText(x, y, text) {
  paths.push({
    type: 'text',
    x, y, text,
  });
  redrawAll();
  debugLog('[NoxSpot] Text added:', text);
}

// Touch event handlers
function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  handleMouseDown(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  handleMouseMove(mouseEvent);
}

function handleTouchEnd(e) {
  const touch = e.changedTouches[0];
  if (touch) {
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    handleMouseUp(mouseEvent);
  } else {
    // Fallback: convert canvas-space lastX/lastY back to client-space
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: lastX / scaleX + rect.left,
      clientY: lastY / scaleY + rect.top,
    });
    handleMouseUp(mouseEvent);
  }
}

// Drawing functions
function drawPreview(x, y) {
  if (currentTool === 'arrow') {
    drawArrow(startX, startY, x, y);
  } else if (currentTool === 'rectangle') {
    drawRectangle(startX, startY, x, y);
  }
}

function redrawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = isMobile ? 4 : STROKE_WIDTH;

  for (const path of paths) {
    if (path.type === 'draw') {
      drawPath(path.points);
    } else if (path.type === 'arrow') {
      drawArrow(path.startX, path.startY, path.endX, path.endY);
    } else if (path.type === 'rectangle') {
      drawRectangle(path.startX, path.startY, path.endX, path.endY);
    } else if (path.type === 'text') {
      drawText(path.x, path.y, path.text);
    }
  }
}

function drawPath(points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawArrow(fromX, fromY, toX, toY) {
  const headLength = 25;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Draw line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Draw arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function drawRectangle(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.rect(x1, y1, x2 - x1, y2 - y1);
  ctx.stroke();
}

function drawText(x, y, text) {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const fontSize = isMobile ? 18 : FONT_SIZE;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.fillStyle = STROKE_COLOR;
  ctx.fillText(text, x, y);
}

/**
 * Cleanup canvas event listeners
 */
export function destroyCanvas() {
  if (!canvas) return;

  hideTextInput();

  canvas.removeEventListener('mousedown', handleMouseDown);
  canvas.removeEventListener('mousemove', handleMouseMove);
  canvas.removeEventListener('mouseup', handleMouseUp);
  canvas.removeEventListener('mouseleave', handleMouseUp);
  canvas.removeEventListener('touchstart', handleTouchStart);
  canvas.removeEventListener('touchmove', handleTouchMove);
  canvas.removeEventListener('touchend', handleTouchEnd);

  canvas = null;
  ctx = null;
  paths = [];
  canvasDisabled = false;
  isDrawing = false;
  currentPath = null;
}
