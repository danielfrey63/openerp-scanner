/// <reference types="vitest" />
/// <reference types="vitest/globals" />

// Extend the Vitest matchers with jest-dom
import '@testing-library/jest-dom';

declare module 'vitest' {
  interface Assertion<T = any> extends jest.Matchers<void, T> {
    toBeInTheDocument(): T;
    toBeVisible(): T;
    toHaveTextContent(text: string): T;
    toHaveAttribute(attr: string, value?: string): T;
  }
}
