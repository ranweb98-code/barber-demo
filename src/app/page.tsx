import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, MapPin, Phone, Scissors, Star } from "lucide-react";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettingsMap } from "@/lib/settings";
import { BUSINESS_NAME, DAY_NAMES, formatDuration, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ public?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { public: publicView } = await searchParams;
  const viewingPublicSite = publicView === "1";

  const [services, settings, workingHours, isAdmin] = await Promise.all([
    prisma.service
      .findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      })
      .catch(() => []),
    getSettingsMap().catch(() => ({}) as Record<string, string>),
    prisma.workingHours.findMany({ orderBy: { dayOfWeek: "asc" } }).catch(() => []),
    isAuthenticated().catch(() => false),
  ]);

  if (isAdmin && !viewingPublicSite) {
    redirect("/admin");
  }

  const phone = settings.businessPhone ?? "";
  const address = settings.businessAddress ?? "";

  return (
    <>
      <PageHero
        businessName={BUSINESS_NAME}
        bottomContent={
          <Link href="/book" className="block">
            <Button className="min-h-14 w-full text-base">
              <Scissors className="h-5 w-5" />
              קבע תור
            </Button>
          </Link>
        }
      />

      <div className="site-container space-y-10 py-8 md:space-y-14 md:py-14">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">
            שדרג את הסגנון שלך
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            בחר שירות, תאריך ושעה — בקלות
          </p>
        </div>

        <div className="card-app flex items-center gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="brand-name brand-name--card">{BUSINESS_NAME}</p>
            <div className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
              <Star className="h-4 w-4 fill-accent-yellow text-accent-yellow" />
              <span>4.9</span>
              <span className="text-text-muted">· מספרה פרימיום</span>
            </div>
          </div>
          <Link href="/book">
            <Button className="shrink-0 px-4 text-sm">קבע תור</Button>
          </Link>
        </div>

        <section>
          <div className="section-heading">
            <h3 className="section-heading__title">השירותים שלנו</h3>
            <p className="section-heading__sub">מחירים שקופים, תוצאה מדויקת</p>
          </div>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="card-app card-app-hover flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <h4 className="font-medium text-text-primary">
                    {service.name}
                  </h4>
                  {service.description && (
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {service.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    {formatDuration(service.durationMin)}
                  </p>
                </div>
                <span className="shrink-0 text-lg font-semibold text-accent-yellow">
                  {formatPrice(service.price)}
                </span>
              </div>
            ))}
          </div>
          <Link href="/book" className="mt-6 block md:hidden">
            <Button variant="secondary" className="w-full">
              קביעת תור
            </Button>
          </Link>
        </section>

        <div className="md:grid md:grid-cols-2 md:gap-10">
          <section className="info-section">
            <div className="section-heading">
              <Clock className="section-heading__icon" />
              <h3 className="section-heading__title">שעות פעילות</h3>
            </div>
            <div className="info-card card-app">
              {workingHours.map((wh) => (
                <div key={wh.dayOfWeek} className="info-row info-row--between">
                  <span className="text-text-secondary">
                    {DAY_NAMES[wh.dayOfWeek]}
                  </span>
                  <span
                    className={
                      wh.isOpen ? "text-text-primary" : "text-text-muted"
                    }
                  >
                    {wh.isOpen ? `${wh.startTime} – ${wh.endTime}` : "סגור"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="info-section pb-8 md:pb-0">
            <div className="section-heading">
              <MapPin className="section-heading__icon" />
              <h3 className="section-heading__title">יצירת קשר</h3>
            </div>
            <div className="info-card card-app">
              {phone && (
                <a
                  href={`tel:${phone.replace(/-/g, "")}`}
                  className="info-row info-row--link"
                >
                  <Phone className="info-row__icon" aria-hidden />
                  <span dir="ltr" className="info-row__text">
                    {phone}
                  </span>
                </a>
              )}
              {address && (
                <div className="info-row">
                  <MapPin className="info-row__icon" aria-hidden />
                  <span dir="ltr" className="info-row__text">
                    {address}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="site-container pb-10 pt-2 text-center md:pb-14">
        {isAdmin ? (
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-medium bg-bg-card px-5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-card-hover"
          >
            חזרה ללוח הניהול
          </Link>
        ) : (
          <Link
            href="/admin/login"
            className="text-[10px] tracking-wide text-text-muted/35 transition-colors hover:text-text-muted/60"
          >
            כניסת מנהל
          </Link>
        )}
      </div>
    </>
  );
}
