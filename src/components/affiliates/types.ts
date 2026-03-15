/**
 * Affiliate Types
 */

export interface PricingEntry {
  id: string;
  serviceType: string;
  flatRate: number;
  notes: string | null;
}

export interface AffiliatePricingGridProps {
  affiliateId: string;
  affiliateName: string;
  pricing: PricingEntry[];
  isAdmin: boolean;
  onClose?: () => void;
}
