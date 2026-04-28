/**
 * Collections Service - All collections-related API calls
 * Single Responsibility: Handle collections data operations
 */
import { api } from '../lib/api';

export const collectionsService = {
  /**
   * Get collections data
   */
  async getCollections(businessId, params = {}) {
    const { days = 7, paid = 'all', payment_method = 'all', service_id = 'all' } = params;
    const response = await api.get(
      `/business/${businessId}/collections?days=${days}&paid=${paid}&payment_method=${payment_method}&service_id=${service_id}`
    );
    return response.data;
  },

  /**
   * Update ticket amount
   */
  async updateAmount(businessId, ticketId, amount) {
    const response = await api.patch(`/business/${businessId}/queue/${ticketId}/amount`, {
      service_price: amount,
    });
    return response.data;
  },

  /**
   * Mark ticket as paid
   */
  async markAsPaid(businessId, ticketId, paymentMethod) {
    const response = await api.patch(`/business/${businessId}/queue/${ticketId}/paid`, {
      paid: true,
      payment_method: paymentMethod,
    });
    return response.data;
  },
};
