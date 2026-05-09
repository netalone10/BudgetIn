import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, GitBranch, History, Rocket, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { changelogItems, getLatestChangelogItem, githubRepositoryUrl, type ChangelogType } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const typeLabel: Record<ChangelogType, string> = {
  release: "Release",
  improvement: "Improvement",
  fix: "Fix",
};

const typeClassName: Record<ChangelogType, string> = {
  release: "border-primary/30 bg-primary/10 text-primary",
  improvement: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  fix: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
};

const ID_RELEASE_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatReleaseDate(value: string) {
  return ID_RELEASE_DATE_FORMAT.format(new Date(`${value}T00:00:00`));
}

function getShortCommitSha() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : null;
}

export default async function ChangelogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");

  const latest = getLatestChangelogItem();
  const shortCommitSha = getShortCommitSha();

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
        <div className="mt-4 overflow-hidden rounded-[32px] border border-border/70 bg-card/90 shadow-sm backdrop-blur md:mt-2">
          <div className="relative p-6 md:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(24,226,153,0.12),rgba(24,226,153,0))]" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <History className="size-5" />
                  </div>
                  <div>
                    <p className="label-mono text-primary">Production Updates</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                      Changelog BudgetIn
                    </h1>
                  </div>
                </div>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Lihat update terbaru yang sudah masuk production, termasuk ringkasan perubahan dan referensi version control di GitHub.
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-background/70 p-4 md:min-w-[260px]">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Rocket className="size-4 text-primary" />
                  Latest production
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>Version</span>
                    <span className="font-semibold text-foreground">{latest.version}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Released</span>
                    <span className="font-semibold text-foreground">{formatReleaseDate(latest.date)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Commit</span>
                    <span className="font-semibold text-foreground">{shortCommitSha ?? "Production env"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <GitBranch className="size-4 text-primary" />
              Version control
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Setiap rilis production dirujuk ke repository GitHub agar perubahan bisa dilacak.
            </p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Semantic versioning
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Nomor versi mengikuti format major.minor.patch untuk membedakan fix, improvement, dan release besar.
            </p>
          </div>
          <Link
            href={githubRepositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ExternalLink className="size-4 text-primary" />
              GitHub repository
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Buka source control BudgetIn untuk melihat commit history dan perubahan teknis.
            </p>
          </Link>
        </div>

        <div className="space-y-4">
          <div className="space-y-1 px-1">
            <h2 className="text-xl font-semibold text-foreground">Riwayat update production</h2>
            <p className="text-sm text-muted-foreground">
              Update terbaru ditampilkan paling atas.
            </p>
          </div>

          <div className="space-y-4">
            {changelogItems.map((item, index) => (
              <article key={`${item.version}-${item.title}`} className="relative rounded-[28px] border border-border/70 bg-card p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                        {item.version}
                      </span>
                      <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", typeClassName[item.type])}>
                        {typeLabel[item.type]}
                      </span>
                      {index === 0 && (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Terbaru
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 text-sm text-muted-foreground md:items-end">
                    <span>{formatReleaseDate(item.date)}</span>
                    {item.githubUrl && (
                      <Link
                        href={item.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Lihat commit
                        <ExternalLink className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-muted/60 p-4">
                  <ul className="space-y-2">
                    {item.changes.map((change) => (
                      <li key={change} className="flex gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
