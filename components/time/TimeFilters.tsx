"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface TimeFiltersProps {
  clients: Client[];
}

export function TimeFilters({ clients }: TimeFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("client") ?? "";
  const startDate = searchParams.get("start") ?? "";
  const endDate = searchParams.get("end") ?? "";
  const billable = searchParams.get("billable") ?? "all";
  const billed = searchParams.get("billed") ?? "all";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasFilters = clientId || startDate || endDate || billable !== "all" || billed !== "all";

  function clearAll() {
    router.replace(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Select value={clientId || "all"} onValueChange={(v) => updateParam("client", v === "all" ? "" : v)}>
        <SelectTrigger className="h-7 text-xs w-40">
          <SelectValue placeholder="All clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clients</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={startDate}
        onChange={(e) => updateParam("start", e.target.value)}
        className="h-7 text-xs w-36"
        placeholder="From"
      />

      <Input
        type="date"
        value={endDate}
        onChange={(e) => updateParam("end", e.target.value)}
        className="h-7 text-xs w-36"
        placeholder="To"
      />

      <Select value={billable} onValueChange={(v) => updateParam("billable", v)}>
        <SelectTrigger className="h-7 text-xs w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All entries</SelectItem>
          <SelectItem value="yes">Billable only</SelectItem>
          <SelectItem value="no">Non-billable</SelectItem>
        </SelectContent>
      </Select>

      <Select value={billed} onValueChange={(v) => updateParam("billed", v)}>
        <SelectTrigger className="h-7 text-xs w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="no">Unbilled</SelectItem>
          <SelectItem value="yes">Billed</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={clearAll}>
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
