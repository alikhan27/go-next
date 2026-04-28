/**
 * Queue Service - All queue-related API calls
 * Single Responsibility: Handle queue data operations
 */
import { api } from '../lib/api';

export const queueService = {
  /**
   * Get queue stats for a business
   */
  async getStats(businessId) {
    const response = await api.get(`/business/${businessId}/stats`);
    return response.data;
  },

  /**
   * Get queue tickets
   */
  async getTickets(businessId) {
    const response = await api.get(`/business/${businessId}/queue`);
    return response.data;
  },

  /**
   * Add walk-in customer
   */
  async addWalkIn(businessId, data) {
    const response = await api.post(`/business/${businessId}/queue/walk-in`, data);
    return response.data;
  },

  /**
   * Update ticket status
   */
  async updateStatus(businessId, ticketId, status) {
    const response = await api.patch(`/business/${businessId}/queue/${ticketId}/status`, { status });
    return response.data;
  },

  /**
   * Complete ticket
   */
  async completeTicket(businessId, ticketId, data) {
    const response = await api.post(`/business/${businessId}/queue/${ticketId}/complete`, data);
    return response.data;
  },

  /**
   * Call next customer
   */
  async callNext(businessId) {
    const response = await api.post(`/business/${businessId}/queue/call-next`);
    return response.data;
  },

  /**
   * Toggle business online status
   */
  async toggleOnline(businessId, isOnline) {
    const response = await api.patch(`/business/${businessId}`, { is_online: isOnline });
    return response.data;
  },
};
