/**
 * useQueue Hook - Queue state management
 * Single Responsibility: Manage queue data and operations
 * Open/Closed: Easy to extend with new queue operations
 */
import { useState, useCallback, useEffect } from 'react';
import { queueService } from '../services/queueService';
import { businessService } from '../services/businessService';
import { useAsync } from './useAsync';

export function useQueue(businessId) {
  const [stats, setStats] = useState({
    waiting: 0,
    serving: 0,
    completed_today: 0,
    no_show_today: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const { loading, error, execute } = useAsync();

  const load = useCallback(async () => {
    if (!businessId) return;

    await execute(async () => {
      const [statsData, ticketsData, servicesData] = await Promise.all([
        queueService.getStats(businessId),
        queueService.getTickets(businessId),
        businessService.getServices(businessId).catch(() => []),
      ]);

      setStats(statsData);
      setTickets(ticketsData);
      setServices((servicesData || []).filter((item) => item.is_active !== false));
    });
  }, [businessId, execute]);

  useEffect(() => {
    load();
  }, [load]);

  const addWalkIn = useCallback(
    async (data) => {
      await execute(async () => {
        await queueService.addWalkIn(businessId, data);
        await load();
      });
    },
    [businessId, execute, load]
  );

  const updateStatus = useCallback(
    async (ticketId, status) => {
      await execute(async () => {
        await queueService.updateStatus(businessId, ticketId, status);
        await load();
      });
    },
    [businessId, execute, load]
  );

  const completeTicket = useCallback(
    async (ticketId, data) => {
      await execute(async () => {
        await queueService.completeTicket(businessId, ticketId, data);
        await load();
      });
    },
    [businessId, execute, load]
  );

  const callNext = useCallback(async () => {
    await execute(async () => {
      await queueService.callNext(businessId);
      await load();
    });
  }, [businessId, execute, load]);

  const toggleOnline = useCallback(
    async (isOnline) => {
      await execute(async () => {
        await queueService.toggleOnline(businessId, isOnline);
      });
    },
    [businessId, execute]
  );

  return {
    stats,
    tickets,
    services,
    loading,
    error,
    refresh: load,
    addWalkIn,
    updateStatus,
    completeTicket,
    callNext,
    toggleOnline,
  };
}
