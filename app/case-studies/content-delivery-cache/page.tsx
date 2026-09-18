import CaseStudy from "@/components/CaseStudy";
import { getCase } from "@/lib/data";

const study = getCase("content-delivery-cache");

export const metadata = {
  title: `${study.title} — Frank Cloud Fabric`,
  description: study.desc,
};

export default function Page() {
  return (
    <CaseStudy
      study={study}
      intro="A masked architecture map of an enterprise Adobe Experience Manager delivery edge. Public read traffic is served from a CDN in front of an Apache dispatcher cache pool and the AEM publish tier. When authors publish, a cache-flush listener schedules a deferred Sling job that invalidates both the dispatcher and the CDN — with a short delay so replication settles first — and flushes dynamic-media renditions."
      highlights={[
        {
          title: "Deferred invalidation",
          body: "Purges run on a delayed job (30 minutes by default, 1 minute for priority publishes) so the edge never serves a stale-then-missing page during replication.",
        },
        {
          title: "Layered caching",
          body: "The CDN fronts a dispatcher cache pool backed by the AEM publish tier, keeping origin load low while still allowing precise, tag-scoped invalidation.",
        },
        {
          title: "Masked for publication",
          body: "Dispatcher host IPs, CDN endpoints, and purge tokens were removed. Credentials live encrypted in the repository and are decrypted only at runtime.",
        },
      ]}
    />
  );
}
