/**
 * Business Service - All business-related API calls
 * Single Responsibility: Handle business data operations
 */
import { api } from '../lib/api';

export const businessService = {
  /**
   * Get services for a business
   */
  async getServices(businessId) {
    const response = await api.get(`/business/${businessId}/services`);
    return response.data;
  },

  /**
   * Get business details
   */
  async getBusinessDetails(businessId) {
    const response = await api.get(`/business/${businessId}`);
    return response.data;
  },

  /**
   * Update business settings
   */
  async updateBusiness(businessId, data) {
    const response = await api.patch(`/business/${businessId}`, data);
    return response.data;
  },
};
