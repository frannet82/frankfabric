import CaseStudy from "@/components/CaseStudy";
import { getCase } from "@/lib/data";

const study = getCase("graphql-endpoint");

export const metadata = {
  title: `${study.title} — Frank Cloud Fabric`,
  description: study.desc,
};

export default function Page() {
  return (
    <CaseStudy
      study={study}
      intro="An architecture map of a universal, headless-ready GraphQL layer in Adobe Experience Manager. AEM's built-in GraphQL API only surfaces Content Fragments, so a compact OSGi service closes the gap: it pages through DAM assets with QueryBuilder in batches of 500, extracts each asset's jcr:content/metadata, and projects it into a Content Fragment — upserting by the asset's JCR UUID so re-runs stay idempotent. AEM then auto-indexes those fragments, and persisted queries stored under /conf are served as cacheable GET requests through the Dispatcher to headless clients — no custom schema or resolver code required."
      highlights={[
        {
          title: "Metadata as a data layer",
          body: "DAM asset metadata is projected into Content Fragments that AEM auto-indexes, turning any repository into a first-class GraphQL data source.",
        },
        {
          title: "Idempotent, memory-safe sync",
          body: "Offset-based pagination keeps memory flat regardless of repository size, and upserting by asset UUID makes the sync safe to re-run at any time.",
        },
        {
          title: "Cacheable persisted queries",
          body: "Queries defined under /conf are executed via GET and cached at the Dispatcher, improving read performance while keeping the schema private.",
        },
      ]}
    />
  );
}
