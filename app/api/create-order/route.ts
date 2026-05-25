import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

// Initialize Razorpay securely using your environment variables
const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID!,
  key_secret: process.env.RAZORPAY_TEST_KEY_SECRET!,
});

// Initialize Supabase to read sessions and log the booking
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, whatsapp, slots, sessionTitle, slotPrice } = body;

    // 1. Fetch the correct session ID based on the title
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('id, total_slots, slots_booked')
      .eq('title', sessionTitle)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 2. Determine if this booking pushes them to the Waitlist
    const isWaitlisted = (sessionData.slots_booked + slots) > sessionData.total_slots;

    // 3. Create the Razorpay Order (amount must be calculated in paise)
    const amountInPaise = slots * slotPrice * 100;
    
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };
    
    const order = await razorpay.orders.create(orderOptions);

    // 4. Save the initiated (but unpaid) booking in Supabase
    const { error: insertError } = await supabase.from('bookings').insert({
      session_id: sessionData.id,
      user_name: name,
      whatsapp_number: whatsapp,
      requested_slots: slots,
      razorpay_order_id: order.id,
      booking_status: isWaitlisted ? 'waitlisted' : 'initiated',
      payment_status: 'pending'
    });

    if (insertError) {
      console.error("Database Insert Error:", insertError);
      return NextResponse.json({ error: 'Failed to log booking' }, { status: 500 });
    }

    // 5. Send the Order ID and amount back to the frontend
    return NextResponse.json({ 
      orderId: order.id, 
      amount: amountInPaise,
      isWaitlisted 
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: 'Something went wrong processing the order' }, { status: 500 });
  }
}