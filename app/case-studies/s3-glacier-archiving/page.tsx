import CaseStudy from "@/components/CaseStudy";
import { getCase } from "@/lib/data";

const study = getCase("s3-glacier-archiving");

export const metadata = {
  title: `${study.title} — Frank Cloud Fabric`,
  description: study.desc,
};

export default function Page() {
  return (
    <CaseStudy
      study={study}
      intro="An architecture map of intelligent DAM archiving that connects Adobe Experience Manager with AWS S3 Glacier. An OSGi configuration service builds the AWS SDK v2 client so credentials rotate without a redeploy. An archive workflow streams an asset's original rendition straight to S3 in the GLACIER_IR storage class, copies its metadata onto a lightweight proxy asset (keeping the DAM searchable), writes the S3 object key back to the asset, and deletes the original to reclaim disk. Restores poll object readiness with headObject, re-ingest the binary through the AssetManager API, and e-mail the requester a direct download link."
      highlights={[
        {
          title: "Cost-aware archive",
          body: "Originals are streamed to S3 Glacier Instant Retrieval — low storage cost with immediate recall — and the S3 key is stored on the asset for a permanent link.",
        },
        {
          title: "Searchable after archive",
          body: "A recursive metadata copy preserves tags, titles, and descriptions on a proxy asset, so the DAM stays fully searchable once the heavy binary is gone.",
        },
        {
          title: "On-demand restore",
          body: "The restore path checks readiness with headObject, re-ingests via AssetManager, and notifies the requester by e-mail once the file is available.",
        },
      ]}
    />
  );
}
