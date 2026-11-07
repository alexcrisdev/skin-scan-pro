import { useEffect, useState } from "react";
import { resolveAnalysisImageUrl } from "@/lib/analysis-images";

export function useAnalysisImage(url: string | null) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setResolved(null);
    const refresh = () => {
      void resolveAnalysisImageUrl(url)
        .then((value) => {
          if (active) setResolved(value);
        })
        .catch(() => {
          if (active) setResolved(null);
        });
    };
    refresh();
    const timer = setInterval(refresh, 3000000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [url]);
  return resolved;
}
