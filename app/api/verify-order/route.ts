import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase securely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    const secret = process.env.RAZORPAY_TEST_KEY_SECRET;
    
    if (!secret) {
       return NextResponse.json({ error: "Razorpay secret not found" }, { status: 500 });
    }

    // Generate the signature mathematically to compare against the one sent by Razorpay
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // Compare the signatures. If they match, the payment is 100% genuine.
    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Update the booking status in your Supabase database from 'pending' to 'paid'
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('razorpay_order_id', razorpay_order_id);

    if (updateError) {
      console.error("Failed to update booking status:", updateError);
      return NextResponse.json({ error: 'Payment verified, but failed to update database' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Payment verified successfully" });
    
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}