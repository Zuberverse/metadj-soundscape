// Make this file a module to enable global augmentation
export {};

// Extend global type for React 18+ concurrent mode testing
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
