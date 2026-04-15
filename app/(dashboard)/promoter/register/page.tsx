import { redirect } from "next/navigation";

import { PromoterRegisterForm } from "@/app/(dashboard)/promoter/register/register-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";

export default async function PromoterRegisterPage() {
  const { profile } = await requireUser();
  if (profile.role === "promoter") {
    redirect("/promoter");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Become a promoter</h1>
        <p className="page-subtitle">
          Create a promoter profile to get a unique promo code and referral
          tracking.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promoter registration</CardTitle>
        </CardHeader>
        <CardContent>
          <PromoterRegisterForm
            defaultDisplayName={profile.full_name ?? profile.email}
          />
        </CardContent>
      </Card>
    </div>
  );
}
