import { Suspense } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatsSectionAsync } from "@/components/dashboard/StatsSectionAsync";
import { StatCardSkeleton } from "@/components/dashboard/StatCard";
import {
  AttentionSection,
  AttentionSectionSkeleton,
} from "@/components/dashboard/AttentionSection";
import {
  UpcomingSection,
  UpcomingSectionSkeleton,
} from "@/components/dashboard/UpcomingSection";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Dashboard" />
      <PageContainer>
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Suspense fallback={<StatCardSkeleton count={4} />}>
            <StatsSectionAsync />
          </Suspense>
        </div>

        {/* Detail sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<AttentionSectionSkeleton />}>
            <AttentionSection />
          </Suspense>
          <Suspense fallback={<UpcomingSectionSkeleton />}>
            <UpcomingSection />
          </Suspense>
        </div>
      </PageContainer>
    </>
  );
}
