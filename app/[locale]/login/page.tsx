import { getTranslations, setRequestLocale } from "next-intl/server";
import LoginForm from "./LoginForm";
import BottomNav from "../components/BottomNav";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-primary">{t("heading")}</h1>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6">
        <LoginForm />
      </main>
      <BottomNav />
    </div>
  );
}
