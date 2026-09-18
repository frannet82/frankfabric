import CaseStudy from "@/components/CaseStudy";
import { getCase } from "@/lib/data";

const study = getCase("publishing-rollout");

export const metadata = {
  title: `${study.title} — Frank Cloud Fabric`,
  description: study.desc,
};

export default function Page() {
  return (
    <CaseStudy
      study={study}
      intro="A view of the AEM publishing workflow. An author triggers a priority replication servlet that drives a Multi-Site Manager rollout, localizes the language master into per-locale live copies, exports expiration and tag metadata, and activates content to the publish tier. Publishing also emits e-mail notifications and writes a record back to the content metadata store."
      highlights={[
        {
          title: "MSM rollout",
          body: "Multi-Site Manager rolls the language master into localized live copies, keeping regional sites in sync from a single authored source.",
        },
        {
          title: "Workflow side-effects",
          body: "Each publish exports expiration dates and tags, notifies stakeholders over SMTP, and syncs a metadata record for downstream reporting.",
        },
        {
          title: "Content lifecycle",
          body: "Exported expiration dates and tags travel with the content, giving downstream systems a governed, reportable record of every publish.",
        },
      ]}
    />
  );
}
