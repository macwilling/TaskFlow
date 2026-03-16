import { TopBar } from "@/components/layout/TopBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Users } from "lucide-react";

export default function TeamPage() {
  return (
    <>
      <TopBar title="Team" description="Manage admin users for your account" />
      <PageContainer>
        <div className="max-w-3xl">
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium">Multi-user support coming soon</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              You&apos;ll be able to invite team members and control their access here.
            </p>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
