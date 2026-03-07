"use client";

import { useCallback, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventApi, EventClickArg, EventSourceFuncArg, EventDropArg } from "@fullcalendar/core";
import { updateTimeEntryDateAction } from "@/app/actions/time";
import { TimeEntryModal, TimeEntryData } from "@/components/time/TimeEntryModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

function localDateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function localTimeStr(d: Date) {
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join(":");
}

export function TimeCalendar({ clients, tasks }: TimeCalendarProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();
  const [editEntry, setEditEntry] = useState<TimeEntryData | undefined>();
  const [dayHours, setDayHours] = useState<Record<string, number>>({});

  const fetchEvents = useCallback(
    async (
      info: EventSourceFuncArg,
      successCallback: (events: object[]) => void,
      failureCallback: (error: Error) => void
    ) => {
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

  function handleEventsSet(events: EventApi[]) {
    const totals: Record<string, number> = {};
    events.forEach((ev) => {
      if (!ev.start) return;
      // For all-day events startStr is "YYYY-MM-DD"; for timed events it's "YYYY-MM-DDTHH:MM:SS±HH:MM"
      const date = ev.startStr.substring(0, 10);
      totals[date] = (totals[date] ?? 0) + ((ev.extendedProps.durationHours as number) ?? 0);
    });
    setDayHours(totals);
  }

  function openCreate(date?: string, time?: string) {
    setEditEntry(undefined);
    setPrefillDate(date ?? localDateStr(new Date()));
    setPrefillTime(time ?? "");
    setModalOpen(true);
  }

  function handleDateClick(arg: DateClickArg) {
    if (arg.allDay) {
      openCreate(localDateStr(arg.date));
    } else {
      // Time-grid click: arg.date is the local Date at the clicked slot
      openCreate(localDateStr(arg.date), localTimeStr(arg.date));
    }
  }

  function handleEventClick(arg: EventClickArg) {
    const ep = arg.event.extendedProps;
    const start = arg.event.start!;
    setEditEntry({
      id: arg.event.id,
      description: ep.description as string,
      clientId: ep.clientId as string,
      taskId: ep.taskId as string | null,
      entryDate: localDateStr(start),
      startTime: arg.event.allDay ? null : (ep.startTime as string | null),
      durationHours: ep.durationHours as number,
      billable: ep.billable as boolean,
      hourlyRate: null,
    });
    setPrefillDate(undefined);
    setPrefillTime(undefined);
    setModalOpen(true);
  }

  async function handleEventDrop(arg: EventDropArg) {
    const start = arg.event.start!;
    const entry_date = localDateStr(start);
    const start_time = arg.event.allDay ? null : localTimeStr(start) + ":00";
    const result = await updateTimeEntryDateAction(arg.event.id, entry_date, start_time);
    if (result.error) {
      arg.revert();
    }
  }

  function handleSuccess() {
    router.refresh();
    calendarRef.current?.getApi().refetchEvents();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => openCreate()}>
          <Plus className="h-3.5 w-3.5" />
          Log time
        </Button>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        }}
        views={{
          listWeek: { buttonText: "Agenda" },
          timeGridWeek: { buttonText: "Week" },
          dayGridMonth: { buttonText: "Month" },
        }}
        events={fetchEvents}
        eventsSet={handleEventsSet}
        editable={true}
        eventDrop={handleEventDrop}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        height="auto"
        scrollTime="08:00:00"
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:30:00"
        dayMaxEvents={4}
        dayCellContent={(arg) => {
          const hours = dayHours[localDateStr(arg.date)];
          return (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                width: "100%",
              }}
            >
              <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
              {hours != null && hours > 0 && (
                <span className="fc-day-hours">
                  {hours % 1 === 0 ? hours : hours.toFixed(1)}h
                </span>
              )}
            </div>
          );
        }}
      />

      <TimeEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
        clients={clients}
        tasks={tasks}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
        entry={editEntry}
      />
    </>
  );
}
