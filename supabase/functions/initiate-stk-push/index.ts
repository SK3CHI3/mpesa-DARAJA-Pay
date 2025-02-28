
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to generate the OAuth token required for M-Pesa API
async function generateMpesaToken() {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing M-Pesa API credentials");
  }

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  
  try {
    const response = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("Failed to generate M-Pesa token");
    }

    return data.access_token;
  } catch (error) {
    console.error("Error generating token:", error);
    throw error;
  }
}

// Format phone number to required format (254XXXXXXXXX)
function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  
  // Handle different formats: 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXX
  if (digitsOnly.startsWith("0")) {
    return "254" + digitsOnly.substring(1);
  } else if (digitsOnly.startsWith("254")) {
    return digitsOnly;
  } else {
    return "254" + digitsOnly;
  }
}

// Main function to initiate STK Push
async function initiateSTKPush(phoneNumber: string, amount: number, userId: string) {
  try {
    const token = await generateMpesaToken();
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    
    if (!shortcode || !passkey) {
      throw new Error("Missing M-Pesa configuration");
    }

    // Generate the password (Base64 of shortcode + passkey + timestamp)
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    
    // Setup the request to M-Pesa API
    const requestBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: Deno.env.get("MPESA_CALLBACK_URL") || "https://example.com/callback",
      AccountReference: "M-Pesa Simplicity",
      TransactionDesc: "Payment for services",
    };

    console.log("Sending request to M-Pesa API:", JSON.stringify(requestBody));

    const response = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const responseData = await response.json();
    console.log("M-Pesa API response:", JSON.stringify(responseData));
    
    return responseData;
  } catch (error) {
    console.error("Error initiating STK Push:", error);
    throw error;
  }
}

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
    const requestData = await req.json();
    const { phoneNumber, amount } = requestData;
    
    // Get the user ID from the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the user with Supabase
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate request data
    if (!phoneNumber || !amount) {
      return new Response(JSON.stringify({ error: "Phone number and amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert transaction record into database
    const { data: transaction, error: insertError } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: user.id,
        phone_number: phoneNumber,
        amount: parseFloat(amount),
        status: "pending"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting transaction:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create transaction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the M-Pesa API to initiate STK Push
    const mpesaResponse = await initiateSTKPush(phoneNumber, parseFloat(amount), user.id);
    
    // Update the transaction with the M-Pesa checkout request ID if available
    if (mpesaResponse.CheckoutRequestID) {
      await supabaseClient
        .from("transactions")
        .update({ mpesa_receipt: mpesaResponse.CheckoutRequestID })
        .eq("id", transaction.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: { 
        transaction_id: transaction.id,
        mpesa_response: mpesaResponse 
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
