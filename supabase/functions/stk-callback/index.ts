
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create a Supabase client with the Deno runtime
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the request body
    const callbackData = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(callbackData));

    // Extract the transaction details from the callback
    const resultCode = callbackData.Body?.stkCallback?.ResultCode;
    const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;
    
    if (checkoutRequestID) {
      // Find the transaction by checkoutRequestID
      const { data: transactions, error: findError } = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("mpesa_receipt", checkoutRequestID)
        .limit(1);
      
      if (findError || !transactions || transactions.length === 0) {
        console.error("Transaction not found for checkout request ID:", checkoutRequestID);
      } else {
        const transaction = transactions[0];
        
        // Update the transaction status based on the result code
        const status = resultCode === 0 ? "completed" : "failed";
        const { error: updateError } = await supabaseClient
          .from("transactions")
          .update({ 
            status: status,
            updated_at: new Date().toISOString(),
            callback_data: callbackData
          })
          .eq("id", transaction.id);
          
        if (updateError) {
          console.error("Error updating transaction:", updateError);
        } else {
          console.log(`Transaction ${transaction.id} updated with status: ${status}`);
        }
      }
    }

    // Respond to the M-Pesa callback
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Callback processed" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing callback:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
