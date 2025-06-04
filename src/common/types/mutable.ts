// src/common/types/mutable.ts
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
