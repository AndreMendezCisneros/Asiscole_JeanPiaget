import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, startOfDay, parse, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
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
            {days.map((day, dayIdx) => (
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
                    {/* Eventos en esta hora */}
                    {getEventsForDate(day)
                      .filter(event => {
                        const eventHour = getHours(new Date(event.start));
                        return eventHour === hour;
                      })
                      .map((event) => {
                        const start = new Date(event.start);
                        const end = new Date(event.end);
                        const startMinutes = getHours(start) * 60 + getMinutes(start);
                        const endMinutes = getHours(end) * 60 + getMinutes(end);
                        const duration = endMinutes - startMinutes;
                        const height = (duration / 60) * 64; // 64px por hora
                        const top = (getMinutes(start) / 60) * 64;

                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "absolute left-1 right-1 rounded px-2 py-1 text-xs cursor-pointer z-10 text-white transition-colors",
                              event.color === 'amber' ? "bg-amber-500 hover:bg-amber-600" :
                              event.color === 'green' ? "bg-green-500 hover:bg-green-600" :
                              event.color === 'gray' ? "bg-gray-500 hover:bg-gray-600" :
                              event.color === 'blue' ? "bg-blue-500 hover:bg-blue-600" :
                              "bg-primary hover:bg-primary/90"
                            )}
                            style={{
                              top: `${top}px`,
                              height: `${Math.max(height, 20)}px`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                          >
                            <div className="font-semibold truncate">{event.title}</div>
                            <div className="text-xs opacity-90 truncate">
                              {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                            </div>
                            {event.student && (
                              <div className="text-xs opacity-75 truncate">
                                {event.student.fullName}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            ))}
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
    const dayEvents = getEventsForDate(day);
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
          <div className="grid grid-cols-2">
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
                  {dayEvents
                    .filter(event => {
                      const eventHour = getHours(new Date(event.start));
                      return eventHour === hour;
                    })
                    .map((event) => {
                      const start = new Date(event.start);
                      const end = new Date(event.end);
                      const startMinutes = getHours(start) * 60 + getMinutes(start);
                      const endMinutes = getHours(end) * 60 + getMinutes(end);
                      const duration = endMinutes - startMinutes;
                      const height = (duration / 60) * 64;
                      const top = (getMinutes(start) / 60) * 64;

                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "absolute left-2 right-2 rounded-lg px-3 py-2 cursor-pointer z-10 shadow-sm text-white transition-colors",
                            event.color === 'amber' ? "bg-amber-500 hover:bg-amber-600" :
                            event.color === 'green' ? "bg-green-500 hover:bg-green-600" :
                            event.color === 'gray' ? "bg-gray-500 hover:bg-gray-600" :
                            event.color === 'blue' ? "bg-blue-500 hover:bg-blue-600" :
                            "bg-primary hover:bg-primary/90"
                          )}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 40)}px`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          <div className="font-semibold">{event.title}</div>
                          <div className="text-sm opacity-90">
                            {format(new Date(event.start), 'HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                          </div>
                          {event.student && (
                            <div className="text-sm opacity-75 mt-1">
                              {event.student.fullName}
                              {event.student.grade && event.student.section && (
                                <span className="ml-2">
                                  {event.student.grade} {event.student.section}
                                </span>
                              )}
                            </div>
                          )}
                          {event.motivo && (
                            <div className="text-xs opacity-70 mt-1">{event.motivo}</div>
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

