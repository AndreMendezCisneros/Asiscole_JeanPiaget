import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, startOfDay, parse, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
import { groupSameSlot, laneStyle, layoutOverlappingEvents } from './eventLayout';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  student?: {
    id: number;
    fullName: string;
    grade?: string;
    section?: string;
  };
  estado?: string;
  motivo?: string;
}

interface ModernCalendarProps {
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: (date: Date, time?: string) => void;
  defaultView?: CalendarView;
  currentDate?: Date;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const ModernCalendar = ({
  events,
  onDateClick,
  onEventClick,
  onCreateEvent,
  defaultView = 'week',
  currentDate = new Date(),
}: ModernCalendarProps) => {
  const [view, setView] = useState<CalendarView>(defaultView);
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);

  // Navegación
  const goToToday = () => setSelectedDate(new Date());
  const goToPrevious = () => {
    if (view === 'week') setSelectedDate(subWeeks(selectedDate, 1));
    else if (view === 'month') setSelectedDate(subMonths(selectedDate, 1));
    else if (view === 'day') setSelectedDate(subDays(selectedDate, 1));
  };
  const goToNext = () => {
    if (view === 'week') setSelectedDate(addWeeks(selectedDate, 1));
    else if (view === 'month') setSelectedDate(addMonths(selectedDate, 1));
    else if (view === 'day') setSelectedDate(addDays(selectedDate, 1));
  };

  // Obtener rango de fechas según la vista
  const dateRange = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(selectedDate, { locale: es });
      const end = endOfWeek(selectedDate, { locale: es });
      return { start, end, days: eachDayOfInterval({ start, end }) };
    } else if (view === 'month') {
      const start = startOfWeek(startOfMonth(selectedDate), { locale: es });
      const end = endOfWeek(endOfMonth(selectedDate), { locale: es });
      return { start, end, days: eachDayOfInterval({ start, end }) };
    } else if (view === 'day') {
      return { start: selectedDate, end: selectedDate, days: [selectedDate] };
    }
    return { start: selectedDate, end: selectedDate, days: [] };
  }, [view, selectedDate]);

  // Filtrar eventos por fecha
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = startOfDay(new Date(event.start));
      const dateStart = startOfDay(date);
      return isSameDay(eventStart, dateStart);
    });
  };

  // Obtener eventos para agenda
  const agendaEvents = useMemo(() => {
    const allEvents = [...events].sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    return allEvents;
  }, [events]);

  const eventColorClass = (color?: string) =>
    color === 'amber' ? "bg-amber-500 hover:bg-amber-600" :
    color === 'green' ? "bg-green-500 hover:bg-green-600" :
    color === 'gray' ? "bg-gray-500 hover:bg-gray-600" :
    color === 'blue' ? "bg-blue-500 hover:bg-blue-600" :
    "bg-primary hover:bg-primary/90";

  /** Posición dentro de la celda de su hora (64 px por hora). */
  const blockMetrics = (start: Date, end: Date, minHeight: number) => {
    const duration = getHours(end) * 60 + getMinutes(end) - (getHours(start) * 60 + getMinutes(start));
    return { top: (getMinutes(start) / 60) * 64, height: Math.max((duration / 60) * 64, minHeight) };
  };

  // Renderizar vista de semana
  const renderWeekView = () => {
    const days = dateRange.days;
    const startHour = 6;
    const endHour = 22;

    return (
      <div className="flex flex-col h-full">
        {/* Header con días */}
        <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
          <div className="p-3 border-r border-gray-200"></div>
          {days.map((day, idx) => (
            <div key={idx} className="p-3 border-r border-gray-200 last:border-r-0">
              <div className="text-xs text-gray-500 uppercase mb-1">
                {format(day, 'EEE', { locale: es })}
              </div>
              <div className={cn(
                "text-lg font-semibold",
                isSameDay(day, new Date()) && "text-blue-600"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Grid de horas */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-8">
            {/* Columna de horas */}
            <div className="border-r border-gray-200">
              {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map((hour) => (
                <div key={hour} className="h-16 border-b border-gray-100 relative">
                  <div className="absolute -top-2 left-2 text-xs text-gray-400">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                </div>
              ))}
            </div>

            {/* Columnas de días */}
            {days.map((day, dayIdx) => {
              const groups = groupSameSlot(getEventsForDate(day));
              const layout = layoutOverlappingEvents(groups);
              return (
              <div key={dayIdx} className="border-r border-gray-200 last:border-r-0 relative">
                {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map((hour) => (
                  <div
                    key={hour}
                    className="h-16 border-b border-gray-100 relative hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      const date = setHours(setMinutes(day, 0), hour);
                      onCreateEvent?.(date, `${hour.toString().padStart(2, '0')}:00`);
                    }}
                  >
                    {/* Eventos en esta hora; una cita masiva es un solo bloque */}
                    {groups
                      .filter((g) => getHours(g.start) === hour)
                      .map((g) => {
                        const { top, height } = blockMetrics(g.start, g.end, 20);
                        const first = g.items[0];
                        const bulk = g.items.length > 1;
                        return (
                          <div
                            key={g.id}
                            className={cn(
                              "absolute overflow-hidden rounded px-1.5 py-1 text-xs cursor-pointer z-10 text-white ring-1 ring-white transition-colors",
                              eventColorClass(first.color),
                            )}
                            style={{ top: `${top}px`, height: `${height}px`, ...laneStyle(layout.get(g.id), 1) }}
                            title={
                              bulk
                                ? `${first.title} · ${g.items.length} estudiantes`
                                : [first.title, first.student?.fullName].filter(Boolean).join(' · ')
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (bulk) {
                                setSelectedDate(day);
                                setView('day');
                              } else {
                                onEventClick?.(first);
                              }
                            }}
                          >
                            <div className="font-semibold truncate">{first.title}</div>
                            <div className="truncate opacity-90">
                              {format(g.start, 'HH:mm')} ·{' '}
                              {bulk ? `${g.items.length} estudiantes` : first.student?.fullName ?? format(g.end, 'HH:mm')}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Renderizar vista de mes
  const renderMonthView = () => {
    const days = dateRange.days;
    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return (
      <div className="flex flex-col h-full">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={idx}
                className={cn(
                  "border-r border-b border-gray-200 p-2 min-h-[100px]",
                  !isCurrentMonth && "bg-gray-50",
                  isToday && "bg-blue-50"
                )}
                onClick={() => {
                  setSelectedDate(day);
                  onDateClick?.(day);
                }}
              >
                <div className={cn(
                  "text-sm font-semibold mb-1",
                  isToday && "text-blue-600",
                  !isCurrentMonth && "text-gray-400"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs px-2 py-1 rounded cursor-pointer truncate text-white",
                        event.color === 'amber' ? "bg-amber-500 hover:bg-amber-600" :
                        event.color === 'green' ? "bg-green-500 hover:bg-green-600" :
                        event.color === 'gray' ? "bg-gray-500 hover:bg-gray-600" :
                        event.color === 'blue' ? "bg-blue-500 hover:bg-blue-600" :
                        "bg-primary hover:bg-primary/90"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                    >
                      {format(new Date(event.start), 'HH:mm')} {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 px-2">
                      +{dayEvents.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renderizar vista de día
  const renderDayView = () => {
    const day = selectedDate;
    const dayGroups = groupSameSlot(getEventsForDate(day));
    const dayLayout = layoutOverlappingEvents(dayGroups);
    const startHour = 6;
    const endHour = 22;

    return (
      <div className="flex flex-col h-full">
        {/* Header del día */}
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="text-2xl font-bold text-gray-900">
            {format(day, 'EEEE, d \'de\' MMMM', { locale: es })}
          </div>
        </div>

        {/* Grid de horas */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[72px_1fr]">
            {/* Columna de horas */}
            <div className="border-r border-gray-200">
              {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map((hour) => (
                <div key={hour} className="h-16 border-b border-gray-100 relative">
                  <div className="absolute -top-2 left-2 text-xs text-gray-400">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                </div>
              ))}
            </div>

            {/* Columna de eventos */}
            <div className="relative">
              {Array.from({ length: endHour - startHour }, (_, i) => startHour + i).map((hour) => (
                <div
                  key={hour}
                  className="h-16 border-b border-gray-100 relative hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => {
                    const date = setHours(setMinutes(day, 0), hour);
                    onCreateEvent?.(date, `${hour.toString().padStart(2, '0')}:00`);
                  }}
                >
                  {dayGroups
                    .filter((g) => getHours(g.start) === hour)
                    .map((g) => {
                      const bulk = g.items.length > 1;
                      const { top, height } = blockMetrics(g.start, g.end, bulk ? 56 + g.items.length * 24 : 60);
                      const first = g.items[0];
                      return (
                        <div
                          key={g.id}
                          className={cn(
                            "absolute overflow-hidden rounded-lg px-3 py-2 z-10 shadow-sm text-white ring-1 ring-white transition-colors",
                            !bulk && "cursor-pointer",
                            eventColorClass(first.color),
                          )}
                          style={{ top: `${top}px`, height: `${height}px`, ...laneStyle(dayLayout.get(g.id), 3) }}
                          title={
                            bulk
                              ? `${first.title} · ${g.items.length} estudiantes`
                              : [first.title, first.student?.fullName].filter(Boolean).join(' · ')
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!bulk) onEventClick?.(first);
                          }}
                        >
                          <div className="font-semibold truncate">{first.title}</div>
                          <div className="text-sm opacity-90">
                            {format(g.start, 'HH:mm')} - {format(g.end, 'HH:mm')}
                            {bulk && ` · Cita masiva, ${g.items.length} estudiantes`}
                          </div>
                          {bulk ? (
                            <ul className="mt-1.5 space-y-0.5">
                              {g.items.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    className="w-full truncate rounded px-1.5 py-0.5 text-left text-sm hover:bg-white/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEventClick?.(item);
                                    }}
                                  >
                                    {item.student?.fullName ?? item.title}
                                    {item.student?.grade && item.student?.section && (
                                      <span className="ml-2 opacity-75">
                                        {item.student.grade} {item.student.section}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            first.student && (
                              <div className="text-sm opacity-75 mt-1 truncate">
                                {first.student.fullName}
                                {first.student.grade && first.student.section && (
                                  <span className="ml-2">
                                    {first.student.grade} {first.student.section}
                                  </span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar vista de agenda
  const renderAgendaView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {agendaEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No hay eventos programados
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {agendaEvents.map((event) => (
                <Card
                  key={event.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center min-w-[60px]">
                      <div className="text-2xl font-bold text-blue-600">
                        {format(new Date(event.start), 'd')}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">
                        {format(new Date(event.start), 'MMM', { locale: es })}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg text-gray-900">{event.title}</div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                        </div>
                        {event.student && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {event.student.fullName}
                          </div>
                        )}
                      </div>
                      {event.motivo && (
                        <div className="mt-2 text-sm text-gray-500">{event.motivo}</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Obtener texto del rango de fechas
  const getDateRangeText = () => {
    if (view === 'week') {
      const start = dateRange.start;
      const end = dateRange.end;
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`;
    } else if (view === 'month') {
      return format(selectedDate, 'MMMM yyyy', { locale: es });
    } else if (view === 'day') {
      return format(selectedDate, 'EEEE, d \'de\' MMMM yyyy', { locale: es });
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header con controles */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToPrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-lg font-semibold text-gray-900 capitalize">
            {getDateRangeText()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className="text-xs"
            >
              Mes
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className="text-xs"
            >
              Semana
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('day')}
              className="text-xs"
            >
              Día
            </Button>
            <Button
              variant={view === 'agenda' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('agenda')}
              className="text-xs"
            >
              Agenda
            </Button>
          </div>
          {onCreateEvent && (
            <Button
              size="sm"
              onClick={() => onCreateEvent(selectedDate)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cita
            </Button>
          )}
        </div>
      </div>

      {/* Contenido del calendario */}
      <div className="flex-1 overflow-hidden">
        {view === 'week' && renderWeekView()}
        {view === 'month' && renderMonthView()}
        {view === 'day' && renderDayView()}
        {view === 'agenda' && renderAgendaView()}
      </div>
    </div>
  );
};

