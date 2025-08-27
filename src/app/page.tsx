'use client';
import { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // In a real app, you'd fetch based on the logged-in user and airline
      const schedulesSnapshot = await getDocs(collection(db, 'airlines', 'default', 'schedules'));
      setSchedules(schedulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setWidgets(['schedule', 'alerts', 'tools']); // Example widgets
    };
    // Disabling fetch for now as it depends on uncreated data
    // fetchData();
     setWidgets(['schedule', 'alerts', 'tools']);
  }, []);

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const reorderedWidgets = Array.from(widgets);
    const [moved] = reorderedWidgets.splice(result.source.index, 1);
    reorderedWidgets.splice(result.destination.index, 0, moved);
    setWidgets(reorderedWidgets);
  };

  return (
    <motion.div
      className="p-6 bg-ivory-white min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-bold text-slate-gray">CrewSync Pro Dashboard</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="widgets">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {widgets.map((widgetId, index) => {
                 return (
                  <Draggable key={widgetId} draggableId={widgetId} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="p-4 bg-ocean-blue text-ivory-white rounded-lg shadow"
                      >
                        {widgetId === 'schedule' && (
                          <div>
                            <h2 className="text-xl">Today’s Schedule</h2>
                            {schedules.map(schedule => (
                              <div key={schedule.id} className="p-2 bg-coral-red rounded mt-2">
                                {schedule.details.flight_number} - {schedule.details.destination}
                              </div>
                            ))}
                             {schedules.length === 0 && <p className="text-sm mt-2">No flights scheduled today.</p>}
                          </div>
                        )}
                         {widgetId === 'alerts' && (
                          <div>
                            <h2 className="text-xl">Active Alerts</h2>
                             <p className="text-sm mt-2">No active alerts.</p>
                          </div>
                        )}
                         {widgetId === 'tools' && (
                          <div>
                            <h2 className="text-xl">Quick Tools</h2>
                             <p className="text-sm mt-2">Toolbox shortcuts coming soon.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </motion.div>
  );
}
