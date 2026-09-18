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
      intro="A masked map of how AEM content metadata is projected into an external relational database. A scheduled service (with an on-demand servlet trigger) runs a content-sync service that scans site pages and DAM assets with QueryBuilder, maps each hit into a report value object, and writes rows in JDBC batches through a named data source pool into an external RDBMS."
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
          title: "Masked for publication",
          body: "The data source pool name is generic, and the JDBC URL, driver, and credentials — supplied externally via OSGi config — are never shown.",
        },
      ]}
    />
  );
}
