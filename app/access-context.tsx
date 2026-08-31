"use client";
import { createContext, useContext } from "react";
export type Viewer = {
  id: string;
  username: string;
  name: string;
  role: "citizen" | "official";
};
export const AccessContext = createContext<Viewer | null>(null);
export function useViewer() {
  return useContext(AccessContext);
}
