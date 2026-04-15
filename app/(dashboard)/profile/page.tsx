import { ProfileForm } from "@/app/(dashboard)/profile/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";

export default async function ProfilePage() {
  const { profile } = await requireUser();
  const locale = getLocale();
  const t = getT(locale).profile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.account}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="font-medium text-slate-900">{t.email_label}</p>
            <p className="text-slate-600">{profile.email}</p>
            <p className="text-xs text-slate-500">{t.email_hint}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-slate-900">{t.role_label}</p>
            <p className="text-slate-600">{profile.role}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.display_name_title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultFullName={profile.full_name} t={t} />
        </CardContent>
      </Card>
    </div>
  );
}
