import { requireSessionUser } from "@/data/auth-repo";
import { Logo } from "@/app/components/Logo";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  await requireSessionUser();

  return (
    <main className="mx-auto max-w-sm p-8">
      <Logo className="mb-8 justify-center" />
      <OnboardingWizard />
    </main>
  );
}
