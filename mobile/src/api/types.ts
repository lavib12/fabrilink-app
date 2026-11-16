// Mirrors the FabriLink backend serializers exactly. Decimal fields arrive as strings.

export type Role = "FACTORY" | "BUYER" | "HUB_STAFF" | "ADMIN";
export type Verification = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  designation: string;
  avatar: string | null;
  preferred_language: "bn" | "en";
}

export interface CompanySummary {
  id: string;
  name: string;
  company_type: "FACTORY" | "BUYER";
  verification_status: Verification;
  credit_limit: string;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  role: Role;
  is_verified: boolean;
  is_active: boolean;
  date_joined: string;
  profile: UserProfile | null;
  company: CompanySummary | null;
}

export interface AuthPayload {
  user: User;
  access_token: string;
  refresh_token?: string;
}

export interface CompanyAddress {
  id: string;
  company: string;
  address_type: "FACTORY_PREMISES" | "WAREHOUSE" | "BILLING" | "DELIVERY";
  division: string;
  district: string;
  upazila_thana: string;
  street_address: string;
  postal_code: string;
  landmark: string;
  gps_lat: string | null;
  gps_lng: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  company_type: "FACTORY" | "BUYER";
  trade_license_number: string;
  tin_number: string;
  bin_number: string;
  trade_license_file: string | null;
  tin_file: string | null;
  bin_file: string | null;
  verification_status: Verification;
  rejection_reason: string;
  contact_email: string;
  contact_phone: string;
  credit_limit: string;
  credit_terms_days: number;
  credit_status: "INELIGIBLE" | "ELIGIBLE" | "ACTIVE" | "BLOCKED";
  addresses: CompanyAddress[];
  created_at: string;
  updated_at: string;
}

export interface BuyerSummary {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  verification_status: Verification;
}

export interface FactoryStore {
  id: string;
  name: string;
  company_type: "FACTORY";
  verification_status: Verification;
  contact_email: string;
  contact_phone: string;
  trade_license_number: string;
  tin_number: string;
  bin_number: string;
  addresses: CompanyAddress[];
  stats: {
    total_active_rolls: number;
    total_available_yards: number;
    fabric_types_count: number;
    compositions: string[];
    custom_profiles_count_for_you: number;
  };
  created_at: string;
}

export interface FabricType {
  id: string;
  name: string;
  slug: string;
  category_name: string;
  default_gsm_range: string;
}

export interface FabricCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  fabric_types: FabricType[];
}

export type QualityGrade = "GRADE_A" | "GRADE_B" | "SURPLUS_FRESH" | "REMNANT";
export type RollStatus = "DRAFT" | "ACTIVE" | "RESERVED_PARTIAL" | "SOLD_OUT" | "ARCHIVED";

export interface FabricRollListItem {
  id: string;
  roll_code: string;
  title: string;
  fabric_type_name: string;
  mill_name: string;
  factory_id: string;
  mill_location: string;
  composition: string;
  gsm: number;
  width_inches: string;
  color_name: string;
  color_hex: string;
  pattern: string;
  finish: string;
  available_yards: string;
  min_cut_length_yards: string;
  price_per_yard: string;
  quality_grade: QualityGrade;
  status: RollStatus;
  is_sample_available: boolean;
  sample_price: string;
  primary_image: string | null;
  target_buyer_id: string | null;
  target_buyer_name: string | null;
  is_custom_profile: boolean;
  buyer_spec_notes: string;
  created_at: string;
}

export interface FabricRollDetail extends Omit<FabricRollListItem, "primary_image"> {
  category_name: string;
  mill_contact_phone: string;
  total_yards: string;
  lot_batch_number: string;
  defect_notes: string;
  updated_at: string;
  images: { id: string; image_url: string; is_primary: boolean; sort_order: number }[];
}

export interface FabricRollCreate {
  title: string;
  fabric_type: string;
  composition: string;
  gsm: number;
  width_inches: number;
  color_name: string;
  color_hex: string;
  pattern?: string;
  finish?: string;
  total_yards: number;
  available_yards?: number;
  min_cut_length_yards?: number;
  price_per_yard: number;
  lot_batch_number?: string;
  quality_grade?: QualityGrade;
  defect_notes?: string;
  is_sample_available?: boolean;
  sample_price?: number;
  image_url?: string;
  /** Up to 6 photo URLs (uploaded ones included); the first is the cover. */
  image_urls?: string[];
  target_buyer_id?: string | null;
  buyer_spec_notes?: string;
  factory_id?: string;
}

export interface RollFilters {
  search?: string;
  category?: string;
  fabric_type?: string;
  min_gsm?: number;
  max_gsm?: number;
  color?: string;
  min_yards?: number;
  max_price?: number;
  factory_id?: string;
  mine?: boolean;
  custom_only?: boolean;
  target_buyer_id?: string;
}

export interface CartItem {
  id: string;
  fabric_roll: string;
  roll_code: string;
  roll_title: string;
  roll_color_name: string;
  roll_color_hex: string;
  roll_gsm: number;
  roll_width: string;
  roll_available_yards: string;
  roll_min_cut: string;
  requested_yards: string;
  unit_price: string;
  item_subtotal: string;
  created_at: string;
}

export interface Fees {
  items_subtotal: string;
  platform_commission_fee: string;
  cutting_fee: string;
  delivery_fee: string;
  vat_tax_amount: string;
  total_amount: string;
}

export interface Cart {
  items: CartItem[];
  fees: Fees | Record<string, never>;
}

export interface CreditSummary {
  credit_limit: string;
  outstanding: string;
  available: string;
  credit_terms_days: number;
  credit_status: "INELIGIBLE" | "ELIGIBLE" | "ACTIVE" | "BLOCKED";
  can_use_credit: boolean;
}

export type SwatchSize = "A4" | "HALF_YARD" | "ONE_YARD";
export type SampleStatus = "REQUESTED" | "ACCEPTED" | "SHIPPED" | "DELIVERED" | "DECLINED" | "CANCELLED";

export interface SampleRequest {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  factory_id: string;
  factory_name: string;
  roll_id: string;
  roll_code: string;
  roll_title: string;
  roll_color_name: string;
  roll_color_hex: string;
  swatch_size: SwatchSize;
  notes: string;
  delivery_address: string;
  sample_price: string;
  status: SampleStatus;
  factory_note: string;
  created_at: string;
  updated_at: string;
}

export interface SampleRequestInput {
  fabric_roll: string;
  swatch_size: SwatchSize;
  notes?: string;
  delivery_address?: string;
}

export interface UploadedImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

export type SourcingStatus = "OPEN" | "FULFILLED" | "CLOSED";

export interface SourcingRequest {
  id: string;
  buyer_id: string;
  buyer_name: string;
  fabric_name: string;
  target_gsm: number | null;
  required_yards: string | null;
  color_preference: string;
  notes: string;
  status: SourcingStatus;
  created_at: string;
  updated_at: string;
}

export interface SourcingRequestInput {
  fabric_name: string;
  target_gsm?: number | null;
  required_yards?: string | null;
  color_preference?: string;
  notes?: string;
}

export type PaymentMethod = "BKASH" | "NAGAD" | "BANK_TRANSFER" | "SSLCOMMERZ" | "B2B_CREDIT" | "COD";
export type ManualPaymentMethod = "BKASH" | "NAGAD" | "BANK_TRANSFER" | "SSLCOMMERZ";
/** Methods the buyer must pay before the order goes ahead (the payment panel shows for these). */
export const MANUAL_PAYMENT_METHODS: readonly PaymentMethod[] = ["BKASH", "NAGAD", "BANK_TRANSFER", "SSLCOMMERZ"];
/** Paid on the SSLCommerz page (bKash / Nagad / cards), like Daraz. */
export const GATEWAY_METHODS: readonly PaymentMethod[] = ["BKASH", "NAGAD", "SSLCOMMERZ"];

/** NOT_REQUIRED: COD / credit. AWAITING: proof not sent yet. Others: the latest proof's state. */
export type OrderPaymentStatus = "NOT_REQUIRED" | "AWAITING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
export type SubmissionStatus = "SUBMITTED" | "VERIFIED" | "REJECTED";

/** Where buyers send money; edited by an admin. Empty strings mean "not set up yet". */
export interface PaymentAccounts {
  bkash_number: string;
  bkash_account_type: "PERSONAL" | "MERCHANT" | "AGENT";
  bkash_account_type_label: string;
  nagad_number: string;
  nagad_account_type: "PERSONAL" | "MERCHANT" | "AGENT";
  nagad_account_type_label: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_name: string;
  bank_branch: string;
  bank_routing_number: string;
  bank_swift_code: string;
  bank_iban: string;
  bank_address: string;
  bank_currencies: string;
  intermediary_bank: string;
  instructions: string;
}

export interface PaymentSubmission {
  id: string;
  order_id: string;
  order_number: string;
  order_total: string;
  buyer_name: string;
  buyer_phone: string;
  method: ManualPaymentMethod;
  method_label: string;
  amount: string;
  currency: string;
  transaction_id: string;
  sender_account: string;
  sender_name: string;
  sender_bank_name: string;
  sender_bank_country: string;
  sender_swift_code: string;
  transfer_date: string | null;
  note: string;
  sender_address: string;
  charges_option: "" | "OUR" | "SHA" | "BEN";
  payment_purpose: string;
  /** Private image URL; needs the user's Authorization header. */
  receipt_url: string | null;
  status: SubmissionStatus;
  review_note: string;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PaymentSubmitInput {
  amount: string;
  currency?: string;
  transaction_id: string;
  sender_account?: string;
  sender_name?: string;
  sender_bank_name?: string;
  sender_bank_country?: string;
  sender_swift_code?: string;
  transfer_date?: string | null;
  note?: string;
  sender_address?: string;
  charges_option?: string;
  payment_purpose?: string;
  receipt_id?: string | null;
}

export type OrderStatus =
  | "DRAFT"
  | "REQUESTED"
  | "QUOTED_CONFIRMED"
  | "PAID_CREDIT_APPROVED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "AT_HUB"
  | "CUTTING"
  | "CUT_DONE"
  | "PACKED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED";

export interface OrderItem {
  id: string;
  fabric_roll: string;
  roll_code: string;
  roll_title: string;
  color_name: string;
  requested_yards: string;
  unit_price: string;
  subtotal: string;
  status: string;
}

export interface TrackingEvent {
  id: string;
  from_status: string;
  to_status: OrderStatus;
  title: string;
  description: string;
  location: string;
  created_at: string;
}

export interface Order extends Fees {
  id: string;
  order_number: string;
  buyer_name: string;
  status: OrderStatus;
  currency: string;
  payment_method: PaymentMethod | string;
  payment_status: OrderPaymentStatus;
  delivery_notes: string;
  cancellation_reason: string;
  items: OrderItem[];
  tracking_events: TrackingEvent[];
  created_at: string;
  updated_at: string;
}
