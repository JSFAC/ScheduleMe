// @ts-nocheck
// pages/api/notify.ts — SECURED (internal only, protected by NOTIFY_SECRET)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  sendBookingConfirmation, sendStatusUpdate, sendWelcomeEmail,
  sendNewBookingBusinessEmail, sendReviewRequestEmail,
  sendBookingCancelledBusinessEmail, sendBookingCancelledConsumerEmail,
  sendNewBusinessApplicationEmail, sendBusinessApplicationReceivedEmail,
  sendStripeAlertEmail,
  sendPaymentReceiptCustomer, sendPaymentNotificationBusiness, sendPaymentRequestCustomer,
  sendCustomerProposedPriceBusiness, sendProviderAcceptedCustomerPrice, sendCustomerAcceptedProviderPrice,
  sendPriceDisputeSubmitted,
  sendFeaturedOnEmail, sendFeaturedOffEmail,
} from '../../lib/email';
import { setSecurityHeaders, rateLimit, isValidEmail } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = req.headers['x-notify-secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  if (!(await rateLimit(req, res, { max: 100, windowMs: 60_000, keyPrefix: 'notify' }))) return;
  const { type, to, name, ...rest } = req.body;
  if (!type || !to) return res.status(400).json({ error: 'type and to are required' });
  if (!isValidEmail(to)) return res.status(400).json({ error: 'Invalid email address' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY not configured' });
  try {
    let result;
    switch (type) {
      case 'booking_confirmation':
        result = await sendBookingConfirmation({ to, name: name || 'there', service: rest.service || 'Service Request', urgency: rest.urgency || 'Standard', location: rest.location || '', matches: rest.matches || [] });
        break;
      case 'status_update':
        result = await sendStatusUpdate({ to, name: name || 'there', service: rest.service || 'Service Request', status: rest.status || 'updated', businessName: rest.businessName });
        break;
      case 'welcome':
        result = await sendWelcomeEmail({ to, name: name || 'there' });
        break;
      case 'new_booking_business':
        result = await sendNewBookingBusinessEmail({
          to,
          businessName: rest.name || 'Your business',
          customerName: rest.customerName || 'A customer',
          service: rest.service || 'Service Request',
          bookingId: rest.bookingId || '',
          scheduledAt: rest.scheduledAt || '',
          note: rest.note || '',
          amountDollars: rest.amountDollars || '',
        });
        break;
      case 'booking_cancelled_business':
        result = await sendBookingCancelledBusinessEmail({
          to,
          businessName: rest.businessName || rest.name || 'Your business',
          customerName: rest.customerName || 'A customer',
          service: rest.service || 'Service Request',
          bookingId: rest.bookingId || '',
          scheduledAt: rest.scheduledAt || '',
          cancellationReason: rest.cancellationReason || 'Not provided',
          cancelledByLabel: rest.cancelledByLabel || `${rest.customerName || 'A customer'} (customer)`,
        });
        break;
      case 'booking_cancelled_consumer':
        result = await sendBookingCancelledConsumerEmail({
          to,
          name: name || 'there',
          businessName: rest.businessName || 'Your provider',
          service: rest.service || 'Service Request',
          bookingId: rest.bookingId || '',
          scheduledAt: rest.scheduledAt || '',
          cancellationReason: rest.cancellationReason || 'Not provided',
          cancelledByLabel: rest.cancelledByLabel || 'Provider',
          refundInProgress: rest.refundInProgress === true,
        });
        break;
      case 'new_business_application':
        result = await sendNewBusinessApplicationEmail({ to, name: rest.name || 'Unknown', ownerName: rest.ownerName || '', email: rest.email || '', phone: rest.phone || '', category: rest.category || '', city: rest.city || '', campusProvider: rest.campusProvider === true, schoolName: rest.schoolName });
        break;
      case 'business_application_received':
        result = await sendBusinessApplicationReceivedEmail({ to, ownerName: rest.ownerName || 'there', businessName: rest.name || 'your business', category: rest.category || 'Service', city: rest.city || '' });
        break;
    case 'review_request':
      result = await sendReviewRequestEmail({ to, name: name || 'there', service: rest.service || 'your service', bookingId: rest.bookingId || '' });
      break;
    case 'stripe_alert':
      result = await sendStripeAlertEmail({ to, subject: rest.subject || 'Stripe alert', body: rest.body || '' });
      break;
      case 'payment_receipt_customer':
        result = await sendPaymentReceiptCustomer({ to, name: name || 'there', service: rest.service || 'Service', businessName: rest.businessName || 'Your provider', amountDollars: rest.amountDollars || '0.00', scheduledAt: rest.scheduledAt, bookingId: rest.bookingId || '' });
        break;
      case 'payment_notification_business':
        result = await sendPaymentNotificationBusiness({ to, businessName: rest.businessName || 'Your business', customerName: rest.customerName || 'A customer', service: rest.service || 'Service', amountDollars: rest.amountDollars || '0.00', platformFeePercent: rest.platformFeePercent ?? 12, payoutDollars: rest.payoutDollars || '0.00', bookingId: rest.bookingId || '' });
        break;
      case 'payment_request_customer':
        result = await sendPaymentRequestCustomer({ to, name: name || 'there', service: rest.service || 'Service', businessName: rest.businessName || 'Your provider', amountDollars: rest.amountDollars || '0.00', bookingId: rest.bookingId || '' });
        break;
      case 'customer_proposed_price':
        result = await sendCustomerProposedPriceBusiness({ to, businessName: rest.businessName || rest.name || 'Your business', customerName: rest.customerName || 'A customer', service: rest.service || 'Service', amountDollars: rest.amountDollars || '0.00', bookingId: rest.bookingId || '' });
        break;
      case 'provider_accepted_customer_price':
        result = await sendProviderAcceptedCustomerPrice({ to, name: name || 'there', service: rest.service || 'Service', businessName: rest.businessName || 'Your provider', amountDollars: rest.amountDollars || '0.00', bookingId: rest.bookingId || '' });
        break;
      case 'customer_accepted_provider_price':
        result = await sendCustomerAcceptedProviderPrice({ to, businessName: rest.businessName || rest.name || 'Your business', amountDollars: rest.amountDollars || '0.00', bookingId: rest.bookingId || '' });
        break;
      case 'price_dispute_submitted':
        result = await sendPriceDisputeSubmitted({ to, name: name || 'there', service: rest.service || 'Service', businessName: rest.businessName || 'Your provider', amountDollars: rest.amountDollars || '0.00', bookingId: rest.bookingId || '' });
        break;
      case 'featured_on':
        result = await sendFeaturedOnEmail({ to, businessName: rest.businessName || rest.name || 'Your business', durationDays: rest.durationDays });
        break;
      case 'featured_off':
        result = await sendFeaturedOffEmail({ to, businessName: rest.businessName || rest.name || 'Your business' });
        break;
      default:
        return res.status(400).json({ error: 'Unknown type: ' + type });
    }
    return res.status(200).json({ success: true, id: (result as any)?.data?.id });
  } catch (err) {
    console.error('[notify]', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
