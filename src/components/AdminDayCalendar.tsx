"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  formatJerusalemDate,
  getJerusalemTimeMinutes,
  isTodayInJerusalem,
  minutesToTime,
  timeToMinutes,
} from "@/lib/timezone";

export type AdminCalendarAppointment = {
  id: number;
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  serviceDuration: number;
  status: "pending" | "confirmed" | "cancelled";
};

type BlockedSlot = {
  id: number;
  startTime: string;
  endTime: string;
  reason: string | null;
};

type AdminDayCalendarProps = {
  date: string;
  appointments: AdminCalendarAppointment[];
  workingHours: { startTime: string; endTime: string } | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onSlotClick?: (time: string) => void;
  onReschedule?: (id: number, time: string) => void | Promise<void>;
  rescheduleTargetId?: number | null;
  rescheduleTarget?: AdminCalendarAppointment | null;
  rescheduleMode?: boolean;
  isClosedDay?: boolean;
  blockedSlotsRefresh?: number;
};

type DragState = {
  id: number;
  startY: number;
  startTop: number;
  currentTop: number;
  originalMinutes: number;
  height: number;
};

type PendingCreateSlot = {
  time: string;
  top: number;
};

type PendingRescheduleSlot = {
  id: number;
  time: string;
  top: number;
  height: number;
};

const PICK_BAR_HEIGHT = 44;

const PX_PER_MINUTE = 3.5;
const MIN_BLOCK_HEIGHT = 44;
const SLOT_STEP = 5;
const DRAG_THRESHOLD_PX = 8;

function BlockLabel({ appt }: { appt: AdminCalendarAppointment }) {
  const startMin = timeToMinutes(appt.time);
  const end = minutesToTime(startMin + appt.serviceDuration);

  return (
    <>
      {appt.customerName}{" "}
      <span className="admin-cal-block__time-range" dir="ltr">
        {appt.time} - {end}
      </span>{" "}
      {appt.serviceName}
    </>
  );
}

function snapToStep(minutes: number): number {
  return Math.round(minutes / SLOT_STEP) * SLOT_STEP;
}

function nextBookableMinute(nowMinutes: number): number {
  return Math.ceil(nowMinutes / SLOT_STEP) * SLOT_STEP;
}

function minutesFromPointer(
  clientY: number,
  canvasTop: number,
  startMinutes: number,
  endMinutes: number
): number {
  const y = clientY - canvasTop;
  const raw = startMinutes + y / PX_PER_MINUTE;
  const snapped = snapToStep(raw);
  return Math.max(startMinutes, Math.min(endMinutes - SLOT_STEP, snapped));
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function AdminDayCalendar({
  date,
  appointments,
  workingHours,
  selectedId,
  onSelect,
  onSlotClick,
  onReschedule,
  rescheduleTargetId = null,
  rescheduleTarget = null,
  rescheduleMode = false,
  isClosedDay = false,
  blockedSlotsRefresh = 0,
}: AdminDayCalendarProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingCreateSlot, setPendingCreateSlot] =
    useState<PendingCreateSlot | null>(null);
  const [pendingRescheduleSlot, setPendingRescheduleSlot] =
    useState<PendingRescheduleSlot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [liveNowMinutes, setLiveNowMinutes] = useState<number | null>(null);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const today = formatJerusalemDate();
  const isToday = isTodayInJerusalem(date);
  const isPastDay = date < today;
  const nowMinutes = isToday ? liveNowMinutes : null;
  const nowLabel =
    isToday && liveNowMinutes !== null
      ? minutesToTime(liveNowMinutes)
      : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPendingCreateSlot(null);
    setPendingRescheduleSlot(null);
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/blocked-slots?date=${encodeURIComponent(date)}`)
      .then((res) => (res.ok ? res.json() : { blockedSlots: [] }))
      .then((data) => {
        if (!cancelled) setBlockedSlots(data.blockedSlots ?? []);
      })
      .catch(() => {
        if (!cancelled) setBlockedSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date, blockedSlotsRefresh]);

  useEffect(() => {
    if (!rescheduleTargetId) {
      setPendingRescheduleSlot(null);
    }
  }, [rescheduleTargetId]);

  useEffect(() => {
    if (!isToday) {
      setLiveNowMinutes(null);
      return;
    }

    const updateNow = () => setLiveNowMinutes(getJerusalemTimeMinutes());
    updateNow();
    const interval = window.setInterval(updateNow, 30_000);
    return () => window.clearInterval(interval);
  }, [isToday, date]);

  const { startMinutes, endMinutes, totalHeight } = useMemo(() => {
    if (!workingHours) {
      return { startMinutes: 0, endMinutes: 0, totalHeight: 0 };
    }
    const start = timeToMinutes(workingHours.startTime);
    const end = timeToMinutes(workingHours.endTime);
    return {
      startMinutes: start,
      endMinutes: end,
      totalHeight: (end - start) * PX_PER_MINUTE,
    };
  }, [workingHours]);

  const minBookableMinutes = useMemo(() => {
    if (isPastDay) return endMinutes;
    if (!isToday || nowMinutes === null) return startMinutes;
    return nextBookableMinute(nowMinutes);
  }, [isPastDay, isToday, nowMinutes, startMinutes, endMinutes]);

  const pastOverlayHeight = useMemo(() => {
    if (isPastDay) return totalHeight;
    if (!isToday || nowMinutes === null) return 0;
    const bookableStart = Math.max(startMinutes, minBookableMinutes);
    return Math.max(0, (bookableStart - startMinutes) * PX_PER_MINUTE);
  }, [
    isPastDay,
    isToday,
    nowMinutes,
    startMinutes,
    minBookableMinutes,
    totalHeight,
  ]);

  const hourLabels = useMemo(() => {
    if (!workingHours) return [];
    const labels: { minutes: number; label: string }[] = [];
    for (let m = startMinutes; m < endMinutes; m += 60) {
      labels.push({ minutes: m, label: minutesToTime(m) });
    }
    return labels;
  }, [workingHours, startMinutes, endMinutes]);

  const dragPreviewMinutes = drag
    ? snapToStep(startMinutes + drag.currentTop / PX_PER_MINUTE)
    : null;

  const draggingAppt = drag
    ? appointments.find((appt) => appt.id === drag.id)
    : null;

  function isBlockedAt(minutes: number, duration = SLOT_STEP): boolean {
    const end = minutes + duration;
    for (const block of blockedSlots) {
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);
      if (rangesOverlap(minutes, end, blockStart, blockEnd)) return true;
    }
    return false;
  }

  function isSlotBookable(minutes: number): boolean {
    if (isClosedDay || isPastDay) return false;
    if (minutes < startMinutes || minutes >= endMinutes - SLOT_STEP) return false;
    if (minutes < minBookableMinutes) return false;
    return !isBlockedAt(minutes);
  }

  function hasConflict(
    minutes: number,
    duration: number,
    excludeId: number
  ): boolean {
    const end = minutes + duration;
    for (const appt of appointments) {
      if (appt.id === excludeId || appt.status === "cancelled") continue;
      const apptStart = timeToMinutes(appt.time);
      const apptEnd = apptStart + appt.serviceDuration;
      if (rangesOverlap(minutes, end, apptStart, apptEnd)) return true;
    }
    if (isBlockedAt(minutes, duration)) return true;
    return false;
  }

  function topFromMinutes(minutes: number): number {
    return (minutes - startMinutes) * PX_PER_MINUTE;
  }

  function snapTop(top: number, height: number): number {
    const rawMinutes = startMinutes + top / PX_PER_MINUTE;
    const snapped = snapToStep(rawMinutes);
    const clampedMinutes = Math.max(
      minBookableMinutes,
      Math.min(endMinutes - SLOT_STEP, snapped)
    );
    const snappedTop = topFromMinutes(clampedMinutes);
    return Math.max(0, Math.min(totalHeight - height, snappedTop));
  }

  function slotFromPointer(clientY: number, canvasEl: HTMLDivElement): number {
    return minutesFromPointer(
      clientY,
      canvasEl.getBoundingClientRect().top,
      startMinutes,
      endMinutes
    );
  }

  function resolveRescheduleTarget(): AdminCalendarAppointment | undefined {
    if (!rescheduleTargetId) return undefined;
    if (rescheduleTarget?.id === rescheduleTargetId) return rescheduleTarget;
    return appointments.find((a) => a.id === rescheduleTargetId);
  }

  function addPendingRescheduleSlot(
    appt: AdminCalendarAppointment,
    minutes: number,
    height: number
  ) {
    const isSameSlot =
      date === appt.date && minutes === timeToMinutes(appt.time);
    if (isSameSlot) return;
    if (!isSlotBookable(minutes)) return;

    if (hasConflict(minutes, appt.serviceDuration, appt.id)) {
      window.alert("השעה החדשה חופפת לתור אחר");
      return;
    }

    const time = minutesToTime(minutes);
    const top = topFromMinutes(minutes);

    setPendingRescheduleSlot((prev) =>
      prev?.time === time ? null : { id: appt.id, time, top, height }
    );
  }

  function selectPendingCreateSlot(minutes: number) {
    if (!isSlotBookable(minutes)) return;

    const time = minutesToTime(minutes);
    const top = topFromMinutes(minutes);

    setPendingCreateSlot((prev) =>
      prev?.time === time ? null : { time, top }
    );
  }

  function handleSlotAction(clientY: number, canvasEl: HTMLDivElement) {
    if (drag) return;

    const minutes = slotFromPointer(clientY, canvasEl);

    if (rescheduleTargetId) {
      const appt = resolveRescheduleTarget();
      if (!appt) return;
      const height = Math.max(
        appt.serviceDuration * PX_PER_MINUTE,
        MIN_BLOCK_HEIGHT
      );
      addPendingRescheduleSlot(appt, minutes, height);
      return;
    }

    if (!onSlotClick) return;
    selectPendingCreateSlot(minutes);
  }

  function clampTop(top: number, height: number): number {
    return Math.max(0, Math.min(totalHeight - height, top));
  }

  function handleBlockPointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    appt: AdminCalendarAppointment,
    top: number,
    height: number
  ) {
    e.stopPropagation();
    if (appt.status === "cancelled" || !onReschedule) return;
    didDragRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: appt.id,
      startY: e.clientY,
      startTop: top,
      currentTop: top,
      originalMinutes: timeToMinutes(appt.time),
      height,
    });
  }

  function handleBlockPointerMove(
    e: React.PointerEvent<HTMLButtonElement>,
    apptId: number
  ) {
    if (!drag || drag.id !== apptId) return;

    e.stopPropagation();
    const deltaY = e.clientY - drag.startY;
    if (Math.abs(deltaY) >= DRAG_THRESHOLD_PX) {
      didDragRef.current = true;
    }
    const nextTop = snapTop(clampTop(drag.startTop + deltaY, drag.height), drag.height);
    setDrag({ ...drag, currentTop: nextTop });
  }

  function handleBlockPointerUp(
    e: React.PointerEvent<HTMLButtonElement>,
    appt: AdminCalendarAppointment
  ) {
    if (!drag || drag.id !== appt.id) return;

    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const moved = didDragRef.current;
    const newMinutes = snapToStep(
      startMinutes + drag.currentTop / PX_PER_MINUTE
    );

    const dragHeight = drag.height;
    setDrag(null);

    if (!moved) {
      return;
    }

    addPendingRescheduleSlot(appt, newMinutes, dragHeight);
  }

  function handleBlockPointerCancel(
    e: React.PointerEvent<HTMLButtonElement>,
    apptId: number
  ) {
    if (!drag || drag.id !== apptId) return;
    e.stopPropagation();
    setDrag(null);
  }

  function confirmCreateSlot(time: string) {
    onSlotClick?.(time);
    setPendingCreateSlot(null);
  }

  async function confirmRescheduleSlot(id: number, time: string) {
    if (!onReschedule) return;
    setConfirming(true);
    try {
      await onReschedule(id, time);
      setPendingRescheduleSlot(null);
    } finally {
      setConfirming(false);
    }
  }

  function renderSlotConfirmDock(
    time: string,
    onConfirm: () => void,
    onDismiss: () => void
  ) {
    if (!mounted) return null;

    // Portal to body so position:fixed is relative to the viewport.
    // Ancestors like .admin-shell keep a transform from entrance animation,
    // which otherwise traps fixed elements at the page bottom.
    return createPortal(
      <div
        className="admin-cal__slot-confirm-dock"
        role="dialog"
        aria-label="אישור שעה"
      >
        <div className="admin-cal__slot-pick-bar">
          <span className="admin-cal__slot-pick-time">{time}</span>
          <button
            type="button"
            className="admin-cal__slot-pick-confirm"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? "..." : "אישור"}
          </button>
          <button
            type="button"
            className="admin-cal__slot-pick-dismiss"
            aria-label="ביטול"
            disabled={confirming}
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  if (!workingHours) {
    return (
      <div className="admin-cal admin-cal--calmark admin-cal--empty">
        <p className="text-center text-sm text-text-secondary">
          {appointments.length > 0
            ? "אין שעות פעילות — בחר תור מהרשימה"
            : "אין תורים ביום זה"}
        </p>
      </div>
    );
  }

  const bookingEnabled =
    Boolean(onSlotClick || rescheduleTargetId) &&
    !isPastDay &&
    !isClosedDay &&
    !drag;

  return (
    <>
      <div
        className={cn(
          "admin-cal admin-cal--calmark",
          isPastDay && "admin-cal--past-day",
          isClosedDay && "admin-cal--closed-day",
          rescheduleMode && "admin-cal--reschedule-mode"
        )}
      >
      <div className="admin-cal__scroll">
        <div className="admin-cal__grid" style={{ height: totalHeight }}>
          <div className="admin-cal__times" aria-hidden="true">
            {hourLabels.map(({ minutes, label }) => (
              <span
                key={label}
                className="admin-cal__time-label"
                style={{ top: topFromMinutes(minutes) }}
              >
                {label}
              </span>
            ))}
            {drag &&
              dragPreviewMinutes !== null &&
              draggingAppt &&
              (() => {
                const endMinutesDrag =
                  dragPreviewMinutes + draggingAppt.serviceDuration;
                return (
                  <>
                    <span
                      className="admin-cal__time-label admin-cal__time-label--drag"
                      style={{ top: topFromMinutes(dragPreviewMinutes) }}
                    >
                      {minutesToTime(dragPreviewMinutes)}
                    </span>
                    <span
                      className="admin-cal__time-label admin-cal__time-label--drag admin-cal__time-label--drag-end"
                      style={{ top: topFromMinutes(endMinutesDrag) }}
                    >
                      {minutesToTime(endMinutesDrag)}
                    </span>
                  </>
                );
              })()}
          </div>

          <div
            ref={canvasRef}
            className={cn(
              "admin-cal__canvas",
              !bookingEnabled && !drag && "admin-cal__canvas--readonly",
              drag && "admin-cal__canvas--dragging",
              (isPastDay || isClosedDay) && "admin-cal__canvas--unavailable"
            )}
            role={bookingEnabled ? "button" : undefined}
            tabIndex={bookingEnabled ? 0 : undefined}
            aria-label={
              bookingEnabled ? "לחץ לקביעת תור בשעה הנבחרת" : undefined
            }
            onClick={(e) => handleSlotAction(e.clientY, e.currentTarget)}
            onKeyDown={(e) => {
              if (!bookingEnabled || (e.key !== "Enter" && e.key !== " ")) {
                return;
              }
              e.preventDefault();
              if (isSlotBookable(minBookableMinutes)) {
                if (rescheduleTargetId) {
                  const appt = resolveRescheduleTarget();
                  if (appt) {
                    addPendingRescheduleSlot(
                      appt,
                      minBookableMinutes,
                      Math.max(
                        appt.serviceDuration * PX_PER_MINUTE,
                        MIN_BLOCK_HEIGHT
                      )
                    );
                  }
                } else {
                  selectPendingCreateSlot(minBookableMinutes);
                }
              }
            }}
          >
            {pastOverlayHeight > 0 && (
              <div
                className="admin-cal__unavailable"
                style={{ height: pastOverlayHeight }}
                aria-hidden="true"
              />
            )}

            {isClosedDay && (
              <div className="admin-cal__closed-overlay" aria-hidden="true">
                <span className="admin-cal__closed-label">סגור היום</span>
              </div>
            )}

            {hourLabels.map(({ minutes }) => (
              <div
                key={minutes}
                className="admin-cal__hour-line"
                style={{ top: (minutes - startMinutes) * PX_PER_MINUTE }}
              />
            ))}

            {pendingCreateSlot && (
              <div
                className="admin-cal__slot-preview admin-cal__slot-preview--create"
                style={{
                  top: pendingCreateSlot.top,
                  height: PICK_BAR_HEIGHT,
                }}
                aria-hidden="true"
              />
            )}

            {pendingRescheduleSlot && (
              <div
                className="admin-cal__slot-preview admin-cal__slot-preview--move"
                style={{
                  top: pendingRescheduleSlot.top,
                  height: pendingRescheduleSlot.height,
                }}
                aria-hidden="true"
              />
            )}

            {isToday &&
              nowMinutes !== null &&
              nowMinutes >= startMinutes &&
              nowMinutes <= endMinutes && (
                <div
                  className="admin-cal__now-line"
                  style={{ top: topFromMinutes(nowMinutes) }}
                >
                  {nowLabel && (
                    <span className="admin-cal__now-badge">{nowLabel}</span>
                  )}
                </div>
              )}

            {blockedSlots.map((block) => {
              const blockStart = timeToMinutes(block.startTime);
              const blockEnd = timeToMinutes(block.endTime);
              const top = (blockStart - startMinutes) * PX_PER_MINUTE;
              const height = Math.max(
                (blockEnd - blockStart) * PX_PER_MINUTE,
                MIN_BLOCK_HEIGHT
              );

              return (
                <div
                  key={block.id}
                  className="admin-cal-block admin-cal-block--blocked"
                  style={{ top, height }}
                  aria-label={
                    block.reason
                      ? `שעות חסומות: ${block.reason}`
                      : "שעות חסומות"
                  }
                >
                  <span className="admin-cal-block__text">
                    {block.reason || "חסום"}
                    <span className="admin-cal-block__time-range" dir="ltr">
                      {block.startTime} - {block.endTime}
                    </span>
                  </span>
                </div>
              );
            })}

            {appointments.map((appt) => {
              const baseTop =
                (timeToMinutes(appt.time) - startMinutes) * PX_PER_MINUTE;
              const height = Math.max(
                appt.serviceDuration * PX_PER_MINUTE,
                MIN_BLOCK_HEIGHT
              );
              const isDragging = drag?.id === appt.id;
              const top = isDragging ? drag.currentTop : baseTop;
              const selected = selectedId === appt.id;
              const draggable =
                Boolean(onReschedule) && appt.status !== "cancelled";

              return (
                <button
                  key={appt.id}
                  type="button"
                  className={cn(
                    "admin-cal-block",
                    appt.status === "pending" && "admin-cal-block--pending",
                    appt.status === "cancelled" &&
                      "admin-cal-block--cancelled",
                    selected && !isDragging && "admin-cal-block--selected",
                    isDragging && "admin-cal-block--dragging",
                    draggable && "admin-cal-block--draggable"
                  )}
                  style={{ top, height }}
                  onPointerDown={(e) =>
                    handleBlockPointerDown(e, appt, baseTop, height)
                  }
                  onPointerMove={(e) => handleBlockPointerMove(e, appt.id)}
                  onPointerUp={(e) => handleBlockPointerUp(e, appt)}
                  onPointerCancel={(e) =>
                    handleBlockPointerCancel(e, appt.id)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    if (didDragRef.current) {
                      didDragRef.current = false;
                      return;
                    }
                    onSelect(appt.id);
                  }}
                >
                  <span className="admin-cal-block__text">
                    <BlockLabel
                      appt={
                        isDragging && dragPreviewMinutes !== null
                          ? {
                              ...appt,
                              time: minutesToTime(dragPreviewMinutes),
                            }
                          : appt
                      }
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {pendingCreateSlot &&
        renderSlotConfirmDock(
          pendingCreateSlot.time,
          () => confirmCreateSlot(pendingCreateSlot.time),
          () => setPendingCreateSlot(null)
        )}

      {pendingRescheduleSlot &&
        renderSlotConfirmDock(
          pendingRescheduleSlot.time,
          () =>
            void confirmRescheduleSlot(
              pendingRescheduleSlot.id,
              pendingRescheduleSlot.time
            ),
          () => setPendingRescheduleSlot(null)
        )}
    </>
  );
}
