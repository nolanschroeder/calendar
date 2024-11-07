import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';


export interface EventExtendedProps {
  description: string;
  category: string;
  completion: boolean;
  priority: string;
}

export interface CalendarEvent {
  id?: string; 
  user_id?: string; 
  title: string;
  start: Date;
  end: Date;
  extendedProps: EventExtendedProps;
}


const useEventManager = () => {
  const supabase = createClient();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const savedEvents: CalendarEvent[] = JSON.parse(localStorage.getItem('events') || '[]');
    setEvents(savedEvents);
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      if (data?.session) {
        fetchEventsForUser(data.session.user.id);
      }
    };
    fetchSession();
  }, [supabase]);

  const fetchEventsForUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_log')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching events:', error);
      } else {
        const formattedEvents = data.map((event: any) => ({
          id: event.task_id,
          title: event.title,
          start: new Date(event.date_interval.split(',')[0].slice(1)),
          end: new Date(event.date_interval.split(',')[1].slice(0, -1)),
          extendedProps: {
            description: event.description || '',
            category: event.category || '',
            completion: event.completion,
            priority: event.priority || '',
          },
        }));
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Exception caught while fetching events:', error);
    }
  };

  // locally store events and save to local storage
  const saveEventsLocally = (updatedEvents: CalendarEvent[]) => {
    setEvents(updatedEvents);
    localStorage.setItem('events', JSON.stringify(updatedEvents));
  };

  // store new event to local storage and save to Supabase (unused.)
  const saveNewEvent = async (newEvent: CalendarEvent) => {
    if (!session) {
      console.error('No active session found. Cannot save event.');
      return;
    }


    const eventStart = new Date(newEvent.start);
    eventStart.setHours(15, 30, 0); 
    const eventCreationTime = eventStart
    .toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
    console.log(eventCreationTime); // Should give the correct time
    console.log(new Date(newEvent.start).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    const formattedEvent = {
      user_id: session.user.id,
      title: newEvent.title,
      category: newEvent.extendedProps.category || '',
      description: newEvent.extendedProps.description || '',
      date_interval: `[${new Date(newEvent.start).toISOString()},${new Date(newEvent.end).toISOString()}]`,
      event_creation_time: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      completion: newEvent.extendedProps.completion,
      priority: newEvent.extendedProps.priority || '',
    };

    try {
      const { data, error } = await supabase
        .from('task_log')
        .insert([formattedEvent]) 
        .select();

      if (error) {
        console.error('Error saving new event to Supabase:', error);
      } else if (data) {
        const newEventWithId = { ...newEvent, id: data[0].task_id };
        saveEventsLocally([...events, newEventWithId]);
      }
    } catch (error) {
      console.error('Exception caught while saving event:', error);
    }
  };

  // delete event from supabase and local storage
  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from("task_log")
        .delete()
        .eq("task_id", eventId);

      if (error) {
        console.error("Error deleting event from Supabase:", error);
        return;
      }

      const updatedEvents = events.filter((event) => event.id !== eventId);
      saveEventsLocally(updatedEvents); 
      setEvents(updatedEvents);
    } catch (err) {
      console.error("Exception caught while deleting event:", err);
    }
  };

  // store all events to local storage and save to Supabase (currently unused)
  const syncEventsWithBackend = async () => {
    if (!session) {
      console.error('No active session found. Cannot sync events.');
      return;
    }

    try {
      const localEvents: CalendarEvent[] = JSON.parse(localStorage.getItem('events') || '[]');
      
      const formattedEvents = localEvents.map(event => ({
        user_id: session.user.id,
        title: event.title,
        date_interval: `[${new Date(event.start).toISOString()},${new Date(event.end).toISOString()}]`,
        event_creation_time: new Date(event.start).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        category: event.extendedProps.category || "",
        completion: event.extendedProps.completion,
        priority: event.extendedProps.priority || "",
        description: event.extendedProps.description || "",
      }));
  
      const { data, error } = await supabase
        .from("task_log")
        .upsert(formattedEvents);

      if (error) {
        console.error('Error syncing events with backend:', error);
      } else {
        console.log('Events successfully synced with backend:', data);
      }
    } catch (error) {
      console.error('Exception caught while syncing events:', error);
    }
  };

  return { events, setEvents, saveEventsLocally, saveNewEvent, fetchEventsForUser, deleteEvent };
};

export default useEventManager;