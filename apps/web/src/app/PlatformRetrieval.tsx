import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { platformApi } from "../api/platform";
import { serviceById } from "./service-registry";

type PlatformRetrievalProps = { organizationId: string; projectId: string };

export function PlatformRetrieval({ organizationId, projectId }: PlatformRetrievalProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const results = useQuery({
    queryKey: ["platform", organizationId, projectId, "retrieval", deferredQuery],
    queryFn: ({ signal }) => platformApi.retrieve(organizationId, projectId, deferredQuery, signal),
    enabled: deferredQuery.length >= 2,
    staleTime: 30_000,
  });
  const open = query.trim().length >= 2;

  return (
    <div className="retrieval">
      <label>
        <span aria-hidden="true">⌕</span>
        <input name="platformSearch" aria-label="Search NoxHere" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search across NoxHere" />
        {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button> : <kbd>⌘K</kbd>}
      </label>
      {open ? (
        <div className="retrieval-panel" role="dialog" aria-label="NoxHere search results">
          <header><div><span className="eyebrow">PLATFORM RETRIEVAL</span><b>Results for “{query.trim()}”</b></div><small>Links open in the owning service</small></header>
          <div className="retrieval-results">
            {results.isLoading ? <p>Searching…</p> : null}
            {results.data?.map((result) => {
              const service = serviceById.get(result.serviceId);
              return <Link to={result.href} key={result.id} onClick={() => setQuery("")}><span style={{ background: service?.softColor, color: service?.color }}>{service?.shortName.at(0)}</span><span><b>{result.title}</b><small>{result.kind} · {result.context}</small></span><em>{service?.name} →</em></Link>;
            })}
            {!results.isLoading && results.data?.length === 0 ? <p>No results in this project.</p> : null}
          </div>
          <footer>NoxHere retrieves references from the selected project.</footer>
        </div>
      ) : null}
    </div>
  );
}
