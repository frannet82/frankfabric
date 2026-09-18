import CaseStudy from "@/components/CaseStudy";
import { getCase } from "@/lib/data";

const study = getCase("metadata-sync");

export const metadata = {
  title: `${study.title} — Frank Cloud Fabric`,
  description: study.desc,
};

export default function Page() {
  return (
    <CaseStudy
      study={study}
      intro="A map of how AEM content metadata is projected into an external relational database. A scheduled service (with an on-demand servlet trigger) runs a content-sync service that scans site pages and DAM assets with QueryBuilder, maps each hit into a report value object, and writes rows in JDBC batches through a named data source pool into an external RDBMS."
      highlights={[
        {
          title: "Two triggers, one path",
          body: "A periodic scheduler and an on-demand servlet share a single content-sync service, so scheduled and ad-hoc runs behave identically.",
        },
        {
          title: "Batched extract & load",
          body: "Pages and DAM assets are scanned with QueryBuilder and upserted in JDBC batches of a thousand rows, keeping the sync efficient at scale.",
        },
        {
          title: "Decoupled store",
          body: "The database is reached through a named data source pool configured via OSGi, so the external RDBMS can change without touching code.",
        },
      ]}
    />
  );
}
