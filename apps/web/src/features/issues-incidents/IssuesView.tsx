import { useQuery } from "@tanstack/react-query";
import { getRawJson } from "../../api/http";
import { ListRow } from "../../components/ListRow";
import { StatusTag } from "../../components/StatusTag";

type IssuesViewProps = { organizationId: string; projectId: string };
type Issue = {
  id: number;
  repo: string;
  number: number;
  title: string;
  html_url?: string;
};
type IssuePage = { data?: Issue[] };

export function IssuesView({ organizationId, projectId }: IssuesViewProps) {
  const issues = useQuery({
    queryKey: ["issues-incidents", organizationId, projectId, "issues"],
    queryFn: ({ signal }) => getRawJson("/api/v1/issues?state=open&page_size=100", signal, { organizationId, projectId }) as Promise<IssuePage>,
  });

  if (issues.isLoading) return <div className="empty-view" role="status"><h2>Loading issues</h2><p>Reading open repository issues…</p></div>;
  if (issues.isError) return <div className="empty-view" role="alert"><h2>Issues are unavailable</h2><p>The project issues API could not be reached.</p></div>;
  const items = issues.data?.data ?? [];
  return <div className="workspace-view">{items.length ? <div className="list-surface">{items.map((issue) => (
    <ListRow key={issue.id} symbol="○" title={issue.title} description={`${issue.repo} · #${issue.number}`} meta={<>{issue.html_url ? <a className="feed-item-link" href={issue.html_url} target="_blank" rel="noreferrer">Open ↗</a> : null}<StatusTag tone="positive">Issue</StatusTag></>} />
  ))}</div> : <div className="empty-view" role="status"><h2>No open issues</h2><p>Issues returned by NoxHere will appear here.</p></div>}</div>;
}
