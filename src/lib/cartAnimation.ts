// src/lib/cartAnimation.ts

export interface FlyToCartPayload {
  imageUrl: string;
  startX: number;
  startY: number;
  id: string; // Unique ID for the animation instance
}

type AnimationCallback = (payload: FlyToCartPayload) => void;

let listeners: AnimationCallback[] = [];

export const subscribeToCartAnimation = (callback: AnimationCallback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
};

export const triggerFlyToCart = (payload: FlyToCartPayload) => {
  listeners.forEach((callback) => callback(payload));
};

// Helper to get the bounding rect of an element safely
export const getElementRect = (element: HTMLElement | null) => {
  if (!element) return { x: 0, y: 0, width: 0, height: 0 };
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
  };
};