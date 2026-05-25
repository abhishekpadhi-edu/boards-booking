'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    slots: 1,
    session: ''
  });

  // Dynamic state from Supabase
  const [availableSlots, setAvailableSlots] = useState(0);
  const [totalSlots, setTotalSlots] = useState(16);
  const [slotPrice, setSlotPrice] = useState(250);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch session data on load
  useEffect(() => {
    async function fetchSession() {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setTotalSlots(data.total_slots);
        // Calculate remaining slots
        setAvailableSlots(data.total_slots - data.slots_booked);
        // Convert the paise price back to rupees for the UI display
        setSlotPrice(data.slot_price / 100); 
        // Auto-select the session title
        setFormData(prev => ({ ...prev, session: data.title }));
      }
      setIsLoading(false);
    }
    
    fetchSession();

    // Inject Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Handlers to increment/decrement slots
  const adjustSlots = (amount: number) => {
    setFormData(prev => ({
      ...prev,
      slots: Math.max(1, Math.min(4, prev.slots + amount)) // Caps booking between 1 and 4 slots
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Reuse your loading state to disable double clicks

    try {
      // 1. Call your backend API route to register the intent and get an Order ID
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          whatsapp: formData.whatsapp,
          slots: formData.slots,
          sessionTitle: formData.session,
          slotPrice: slotPrice // Sent as standard rupees (e.g., 250); backend converts to paise
        })
      });

      const orderData = await orderResponse.json();

      if (orderData.error) {
        alert(`Order Creation Failed: ${orderData.error}`);
        setIsLoading(false);
        return;
      }

      // 2. Configure the Razorpay Checkout Options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID, 
        amount: orderData.amount, // Amount returned by backend in paise
        currency: "INR",
        name: "Boards of Bhubaneswar",
        description: orderData.isWaitlisted ? "Waitlist Registration" : "Seat Reservation",
        order_id: orderData.orderId,
        handler: async function (response: any) {
          // This block fires automatically when payment succeeds!
          console.log("Razorpay Response:", response);
          alert(`🎉 Booking successful!\nPayment ID: ${response.razorpay_payment_id}\nOrder ID: ${response.razorpay_order_id}`);
          
          // Refresh the page or redirect to clean up states
          window.location.reload();
        },
        prefill: {
          name: formData.name,
          contact: formData.whatsapp,
        },
        theme: {
          color: "#4A2F2D", // Matches your beautiful brown theme brand color
        },
        modal: {
          ondismiss: function() {
            setIsLoading(false);
          }
        }
      };

      // 3. Open the secure checkout iframe
      const paymentObject = new (window as any).Razorpay(options);
      
      paymentObject.on('payment.failed', function (response: any) {
        alert(`Payment Failed: ${response.error.description}`);
        setIsLoading(false);
      });
      
      paymentObject.open();
      
    } catch (error) {
      console.error("Checkout handling error:", error);
      alert("Something went wrong loading the payment gateway window.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#E5B9BA] flex items-center justify-center font-serif text-[#4A2F2D] text-xl font-bold">Loading session data...</div>;
  }

  return (
    <main className="min-h-screen bg-[#E5B9BA] flex flex-col items-center justify-between p-4 md:p-8 font-serif text-[#4A2F2D]">
      
      {/* Header / Logo Space */}
      <div className="text-center mt-6 mb-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-wide uppercase drop-shadow-sm">
          Boards of Bhubaneswar
        </h1>
        <p className="text-xs tracking-[0.2em] font-sans font-bold uppercase mt-2 opacity-80">
          Boards When Bored.
        </p>
      </div>

      {/* Main Booking Card */}
      <div className="w-full max-w-md bg-[#FDF3E7] border-2 border-[#4A2F2D] rounded-xl p-6 shadow-[6px_6px_0px_0px_rgba(74,47,45,1)]">
        <h2 className="text-xl md:text-2xl font-bold text-center border-b-2 border-[#4A2F2D] pb-3 mb-6 tracking-tight">
          SESSION BOOKING: Upcoming Event
        </h2>

        <form onSubmit={handleBookingSubmit} className="space-y-5">
          {/* Session Dropdown (Now populated dynamically) */}
          <div>
            <label className="block text-xs font-sans font-bold uppercase tracking-wider mb-1">Select Session</label>
            <select 
              name="session"
              value={formData.session}
              onChange={handleInputChange}
              className="w-full bg-[#FDF3E7] border border-[#4A2F2D] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#4A2F2D] text-sm"
            >
              <option value={formData.session}>{formData.session}</option>
            </select>
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block text-xs font-sans font-bold uppercase tracking-wider mb-1">Your Full Name</label>
            <input 
              type="text"
              name="name"
              required
              placeholder="e.g., Abhishek Padhi"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full bg-[#FDF3E7] border border-[#4A2F2D] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#4A2F2D] text-sm placeholder-[#4A2F2D]/50"
            />
          </div>

          {/* WhatsApp Contact Input */}
          <div>
            <label className="block text-xs font-sans font-bold uppercase tracking-wider mb-1">Contact Number (WhatsApp)</label>
            <input 
              type="tel"
              name="whatsapp"
              required
              placeholder="10-digit mobile number"
              value={formData.whatsapp}
              onChange={handleInputChange}
              className="w-full bg-[#FDF3E7] border border-[#4A2F2D] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#4A2F2D] text-sm placeholder-[#4A2F2D]/50"
            />
          </div>

          {/* Number of Slots Counter */}
          <div>
            <label className="block text-xs font-sans font-bold uppercase tracking-wider mb-1">Number of Slots</label>
            <div className="flex items-center border border-[#4A2F2D] rounded-lg overflow-hidden bg-[#FDF3E7]">
              <button 
                type="button"
                onClick={() => adjustSlots(-1)}
                className="w-12 h-11 border-r border-[#4A2F2D] hover:bg-[#4A2F2D]/10 active:bg-[#4A2F2D]/20 text-lg font-bold transition-colors"
              >
                —
              </button>
              <div className="flex-1 text-center font-sans font-bold text-base">
                {formData.slots}
              </div>
              <button 
                type="button"
                onClick={() => adjustSlots(1)}
                className="w-12 h-11 border-l border-[#4A2F2D] hover:bg-[#4A2F2D]/10 active:bg-[#4A2F2D]/20 text-lg font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Live Capacity Display */}
          <div className="text-sm font-bold flex justify-between items-center px-1 pt-1">
            <span>Available Slots:</span>
            <span className="font-sans text-base">{availableSlots} / {totalSlots}</span>
          </div>

          {/* Checkout Button */}
          <button 
            type="submit" 
            className="w-full bg-[#4A2F2D] text-[#FDF3E7] font-bold py-3.5 rounded-lg border border-[#4A2F2D] hover:bg-[#5c3b39] active:translate-y-[1px] transition-all text-base shadow-sm uppercase tracking-wider mt-2"
          >
            Book & Pay ₹{formData.slots * slotPrice}
          </button>
        </form>
      </div>

      {/* Footer Branding */}
      <div className="text-center mt-6 text-xs font-sans font-bold opacity-70 space-y-1">
        <p>Bookings close 1 hour before the session.</p>
        <p className="tracking-wide">Powered by ▲ Vercel & Supabase</p>
      </div>
    </main>
  );
}