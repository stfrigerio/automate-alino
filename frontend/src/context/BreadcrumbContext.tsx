import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Crumb } from "../components/Breadcrumb";

interface BreadcrumbContextValue {
  crumbs: Crumb[];
  setCrumbs: (crumbs: Crumb[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({ crumbs: [], setCrumbs: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Home" }]);
  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb(items: Crumb[]) {
  const { setCrumbs } = useContext(BreadcrumbContext);
  const key = JSON.stringify(items);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCrumbs(items); }, [key]);
}

export function useBreadcrumbCrumbs() {
  return useContext(BreadcrumbContext).crumbs;
}
