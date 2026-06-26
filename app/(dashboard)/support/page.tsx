export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { SupportChat } from "@/components/support/support-chat";

export default async function SupportPage() {
  const { profile } = await requireUser();
  const locale = getLocale();
  const zh = locale === "zh";

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-8 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {zh ? "联系客服" : "Contact Support"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {zh
            ? "向我们的团队发送消息，我们会实时回复您。"
            : "Message our team — we reply in real time."}
        </p>
      </div>

      <div className="h-[70vh] min-h-[460px]">
        <SupportChat
          conversationProfileId={profile.id}
          isAdmin={false}
          locale={locale === "zh" ? "zh" : "en"}
        />
      </div>
    </div>
  );
}
