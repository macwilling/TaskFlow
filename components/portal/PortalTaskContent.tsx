"use client";
import dynamic from "next/dynamic";

const MilkdownEditor = dynamic(
  () => import("@/components/editor/MilkdownEditor"),
  { ssr: false }
);

export function PortalReadOnlyEditor({ value }: { value: string }) {
  return <MilkdownEditor value={value} readOnly minHeight="80px" />;
}
