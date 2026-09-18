import CaseStudy from "@/components/CaseStudy";
import { getCase } from "@/lib/data";

const study = getCase("external-integrations");

export const metadata = {
  title: `${study.title} — Frank Cloud Fabric`,
  description: study.desc,
};

export default function Page() {
  return (
    <CaseStudy
      study={study}
      intro="A map of how AEM reaches partner systems. Integration services obtain an OAuth token from an API gateway that acts as the trust boundary, then fan out to product-information, registration, video, and search backends. End-user identity is federated over SAML SSO, and an enterprise directory resolves users and roles. Configuration secrets stay encrypted in the repository and are decrypted only at runtime."
      highlights={[
        {
          title: "Gateway trust boundary",
          body: "Partner APIs are reachable only through an OAuth2 token-broker gateway, so credentials and traffic never cross the boundary in the clear.",
        },
        {
          title: "Federated identity",
          body: "SAML SSO federates end-user identity while the enterprise directory supplies user and role lookups for authorization decisions.",
        },
        {
          title: "Secrets at runtime",
          body: "Configuration secrets stay encrypted in the repository and are decrypted only at runtime, so no credential is ever stored in source.",
        },
      ]}
    />
  );
}
