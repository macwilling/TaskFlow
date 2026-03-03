"use client";

import { useCallback, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventSourceFuncArg, EventDropArg } from "@fullcalendar/core";
import { updateTimeEntryDateAction } from "@/app/actions/time";
import { TimeEntryModal, TimeEntryData } from "@/components/time/TimeEntryModal";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  color: string | null;
  default_rate: number | null;
}

interface Task {
  id: string;
  title: string;
  client_id: string;
}

interface TimeCalendarProps {
  clients: Client[];
  tasks: Task[];
}

export function TimeCalendar({ clients, tasks }: TimeCalendarProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [editEntry, setEditEntry] = useState<TimeEntryData | undefined>();

  const fetchEvents = useCallback(
    async (info: EventSourceFuncArg, successCallback: (events: object[]) => void, failureCallback: (error: Error) => void) => {
      try {
        const start = info.startStr.split("T")[0];
        const end = info.endStr.split("T")[0];
        const res = await fetch(`/api/time-entries?start=${start}&end=${end}`);
        if (!res.ok) throw new Error("Failed to load time entries");
        const events = await res.json();
        successCallback(events);
      } catch (err) {
        failureCallback(err instanceof Error ? err : new Error(String(err)));
      }
    },
    []
  );

  function handleDateClick(arg: DateClickArg) {
    setEditEntry(undefined);
    setPrefillDate(arg.dateStr);
    setModalOpen(true);
  }

  function handleEventClick(arg: EventClickArg) {
    const ep = arg.event.extendedProps;
    setEditEntry({
      id: arg.event.id,
      description: ep.description as string,
      clientId: ep.clientId as string,
      taskId: ep.taskId as string | null,
      entryDate: arg.event.startStr,
      durationHours: ep.durationHours as number,
      billable: ep.billable as boolean,
      hourlyRate: null,
    });
    setPrefillDate(undefined);
    setModalOpen(true);
  }

  async function handleEventDrop(arg: EventDropArg) {
    const newDate = arg.event.startStr;
    const result = await updateTimeEntryDateAction(arg.event.id, newDate);
    if (result.error) {
      arg.revert();
    }
  }

  function handleSuccess() {
    router.refresh();
    // Refetch calendar events
    const api = calendarRef.current?.getApi();
    api?.refetchEvents();
  }

  return (
    <>
      <div className="fc-wrapper [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-semibold [&_.fc-button]:text-xs [&_.fc-button]:capitalize [&_.fc-button-primary]:bg-primary [&_.fc-button-primary]:border-primary [&_.fc-button-primary:hover]:opacity-90 [&_.fc-button-primary:not(.fc-button-active)]:bg-muted [&_.fc-button-primary:not(.fc-button-active)]:text-foreground [&_.fc-button-primary:not(.fc-button-active)]:border-border [&_.fc-button-primary:not(.fc-button-active):hover]:bg-accent [&_.fc-daygrid-day-number]:text-xs [&_.fc-col-header-cell-cushion]:text-xs [&_.fc-col-header-cell-cushion]:font-medium [&_.fc-event]:cursor-pointer [&_.fc-event-title]:truncate">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          events={fetchEvents}
          editable={true}
          eventDrop={handleEventDrop}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height="auto"
          dayMaxEvents={4}
          eventTimeFormat={{ hour: "numeric", minute: "2-digit" }}
        />
      </div>

      <TimeEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
        clients={clients}
        tasks={tasks}
        prefillDate={prefillDate}
        entry={editEntry}
      />
    </>
  );
}
