"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAppointmentSheet,
  type AdminSheetAppointment,
} from "@/components/admin/AdminAppointmentSheet";
import { AdminBlockedHours } from "@/components/admin/AdminBlockedHours";
import {
  AdminDayCalendar,
  type AdminCalendarAppointment,
} from "@/components/AdminDayCalendar";
import { AdminCreateAppointmentModal } from "@/components/AdminCreateAppointmentModal";
import { DatePickerBar } from "@/components/DatePickerBar";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WeekDayStrip } from "@/components/WeekDayStrip";
import {
  deriveHoursFromAppointments,
  getDefaultScheduleDate,
  isWorkingDay,
} from "@/lib/day-availability";
import { fetchWithCache, getCachedData } from "@/lib/fetch-cache";
import {
  formatJerusalemDate,
  getJerusalemDayOfWeek,
} from "@/lib/timezone";

type Appointment = AdminCalendarAppointment &
  AdminSheetAppointment & {
    inspoIds: string;
    customerId?: number | null;
  };

type WorkingHour = {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

type Service = {
  id: number;
  name: string;
  durationMin: number;
  price: number;
};

const PUBLIC_CACHE_KEY = "public-api";

export default function AdminPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(formatJerusalemDate());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialTime, setCreateInitialTime] = useState("");
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [blockedSlotsRefresh, setBlockedSlotsRefresh] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const apptRes = await fetch("/api/appointments");

      if (apptRes.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      const apptData = await apptRes.json();
      setAppointments(apptData.appointments ?? []);

      const cachedPublic = getCachedData<{
        workingHours: WorkingHour[];
        blockedDates: string[];
        services: Service[];
      }>(PUBLIC_CACHE_KEY);
      if (cachedPublic?.workingHours) {
        setWorkingHours(cachedPublic.workingHours);
      }
      if (cachedPublic?.blockedDates) {
        setBlockedDates(cachedPublic.blockedDates);
      }
      if (cachedPublic?.services) {
        setServices(cachedPublic.services);
      }

      fetchWithCache<{
        workingHours: WorkingHour[];
        blockedDates: string[];
        services: Service[];
      }>(PUBLIC_CACHE_KEY, "/api/public")
        .then((data) => {
          setWorkingHours(data.workingHours ?? []);
          setBlockedDates(data.blockedDates ?? []);
          setServices(data.services ?? []);
        })
        .catch(() => {
          /* keep cached data if any */
        });
    } catch {
      setError("שגיאה בטעינת תורים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void load();
      }
    }

    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      window.clearInterval(interval);
    };
  }, [load]);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, selectedDate]
  );

  const dayWorkingHours = useMemo(() => {
    const dayOfWeek = getJerusalemDayOfWeek(selectedDate);
    const wh = workingHours.find((w) => w.dayOfWeek === dayOfWeek);
    if (wh) {
      return { startTime: wh.startTime, endTime: wh.endTime };
    }
    const fromAppts = deriveHoursFromAppointments(dayAppointments);
    if (fromAppts) return fromAppts;
    const typicalDay = workingHours.find((w) => w.isOpen);
    if (typicalDay) {
      return { startTime: typicalDay.startTime, endTime: typicalDay.endTime };
    }
    return null;
  }, [workingHours, selectedDate, dayAppointments]);

  const appointmentHighlightDates = useMemo(() => {
    const dates = new Set<string>();
    for (const appt of appointments) {
      dates.add(appt.date);
    }
    return [...dates];
  }, [appointments]);

  const calendarToday = formatJerusalemDate();

  const homeDate = useMemo(() => {
    if (workingHours.length === 0) return calendarToday;
    return getDefaultScheduleDate(workingHours, blockedDates);
  }, [workingHours, blockedDates, calendarToday]);

  const homeDateLabel =
    homeDate === calendarToday ? "חזרה להיום" : "חזרה ליום הקרוב";

  const isClosedDay = useMemo(() => {
    if (workingHours.length === 0) return false;
    return !isWorkingDay(selectedDate, workingHours, blockedDates);
  }, [workingHours, blockedDates, selectedDate]);

  const selectedAppt =
    appointments.find((a) => a.id === selectedId) ?? null;

  const rescheduleAppt =
    appointments.find((a) => a.id === rescheduleId) ?? null;

  async function patchAppointment(
    id: number,
    body: Record<string, unknown>
  ) {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "שגיאה בעדכון");
        return false;
      }

      await load();
      return true;
    } catch {
      setError("שגיאה בעדכון");
      return false;
    } finally {
      setUpdating(false);
    }
  }

  async function deleteAppointment(id: number) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "שגיאה במחיקה");
        return;
      }

      setSelectedId(null);
      await load();
    } catch {
      setError("שגיאה במחיקה");
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreated(created: {
    date: string;
    status: Appointment["status"];
  }) {
    setSelectedDate(created.date);
    setSelectedId(null);
    setCreateInitialTime("");
    await load();
  }

  function openCreateAtTime(time: string) {
    setCreateInitialTime(time);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateInitialTime("");
  }

  async function handleDragReschedule(id: number, time: string) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;

    const ok = await patchAppointment(id, {
      date: selectedDate,
      time,
      serviceId: appt.serviceId,
    });
    if (ok) setRescheduleId(null);
  }

  function startCalendarReschedule(id: number) {
    setSelectedId(null);
    setRescheduleId(id);
    setError("");
  }

  function cancelCalendarReschedule() {
    setRescheduleId(null);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="admin-shell">
        <div className="admin-date-nav">
          <WeekDayStrip
            selectedDate={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedId(null);
            }}
            workingHours={workingHours}
            blockedDates={blockedDates}
            allowPastDates={false}
            hidePastDates
            restrictAvailability={false}
            markClosedDays
            anchorToToday
            daysToShow={14}
            variant="calmark"
            highlightDates={appointmentHighlightDates}
            homeDate={homeDate}
            homeDateLabel={homeDateLabel}
            afterDays={
              <DatePickerBar
                selectedDate={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setSelectedId(null);
                }}
                workingHours={workingHours}
                blockedDates={blockedDates}
                allowPastDates
                compact
                className="admin-date-nav__calendar"
              />
            }
          />
        </div>

        <div className="admin-shell__main">
          {rescheduleAppt && (
            <div className="admin-reschedule-banner">
              <p>
                בחר יום ושעה חדשים בלוח עבור{" "}
                <strong>{rescheduleAppt.customerName}</strong>
              </p>
              <button
                type="button"
                className="admin-reschedule-banner__cancel"
                onClick={cancelCalendarReschedule}
              >
                ביטול
              </button>
            </div>
          )}

          {error && (
            <div className="px-4 pb-2">
              <ErrorMessage message={error} />
            </div>
          )}

          <div className="px-4 pb-2">
            <AdminBlockedHours
              date={selectedDate}
              onChanged={() => setBlockedSlotsRefresh((n) => n + 1)}
            />
          </div>

          <AdminDayCalendar
            date={selectedDate}
            appointments={dayAppointments}
            workingHours={dayWorkingHours}
            blockedSlotsRefresh={blockedSlotsRefresh}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSlotClick={openCreateAtTime}
            onReschedule={handleDragReschedule}
            rescheduleTargetId={rescheduleId}
            rescheduleTarget={rescheduleAppt}
            rescheduleMode={Boolean(rescheduleId)}
            isClosedDay={isClosedDay}
          />
        </div>
      </div>

      <AdminAppointmentSheet
        appointment={selectedAppt}
        services={services}
        loading={updating}
        onClose={() => setSelectedId(null)}
        onConfirm={(id) => patchAppointment(id, { status: "confirmed" })}
        onCancel={(id, noShow) =>
          patchAppointment(id, {
            status: "cancelled",
            ...(noShow ? { notes: "הברזה" } : {}),
          })
        }
        onDelete={deleteAppointment}
        onSaveNotes={(id, notes) => patchAppointment(id, { notes })}
        onStartCalendarReschedule={startCalendarReschedule}
        onUpdateSchedule={async (id, data) => {
          const ok = await patchAppointment(id, data);
          if (ok) await load();
        }}
        onUpdatePhone={async (id, phone) => {
          const ok = await patchAppointment(id, { customerPhone: phone });
          if (ok) await load();
        }}
        onSwitchService={async (id, serviceId) => {
          const ok = await patchAppointment(id, { serviceId });
          if (ok) await load();
        }}
      />

      <AdminCreateAppointmentModal
        open={showCreateModal}
        initialDate={selectedDate}
        initialTime={createInitialTime}
        onClose={closeCreateModal}
        onCreated={handleCreated}
      />
    </>
  );
}
